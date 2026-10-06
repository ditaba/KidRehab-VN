import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Public } from '../common/decorators';
import { LoginDto } from './auth.dto';
import { AuthService } from './auth.service';

export const REFRESH_COOKIE = 'kr_refresh';

function cookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    expires,
  };
}

/**
 * The refresh token is only ever sent as an httpOnly cookie – it is never exposed to
 * JavaScript. The short-lived access token is returned in the body and kept in memory
 * by the web client.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, refreshExpiresAt, ...result } = await this.auth.login(dto.email, dto.password);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(refreshExpiresAt));
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { refreshToken, refreshExpiresAt, ...result } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
      res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(refreshExpiresAt));
      return result;
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
