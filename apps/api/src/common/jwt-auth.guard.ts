import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthUser, JwtPayload } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

/** Global guard: every route requires a valid Bearer access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing access token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    // PARENT accounts are reserved for the future Parent Portal and cannot use the staff API.
    if (payload.role === Role.PARENT) throw new UnauthorizedException('Not allowed');

    const user: AuthUser = {
      id: payload.sub,
      clinicId: payload.clinicId,
      role: payload.role,
      email: payload.email,
      fullName: payload.name,
    };
    request.user = user;
    return true;
  }
}
