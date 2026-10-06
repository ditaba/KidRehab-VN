import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export const INVALID_CREDENTIALS = 'Invalid email or password';

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = '$2b$10$Nx2frZXnbfWJdb.TYHMhNe0OX.5zFT1RW83Rkc108x5ggyfQb2Ciq';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function toPublicUser(user: Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'clinicId'>) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, clinicId: user.clinicId };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private get refreshTtlMs() {
    return Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 24 * 60 * 60 * 1000;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive || user.role === Role.PARENT) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const tokens = await this.issueTokens(user);
    await this.audit.log(user, AuditAction.LOGIN, 'User', user.id);
    return { ...tokens, user: toPublicUser(user) };
  }

  /** Rotates a refresh token. Re-use of a revoked token revokes the whole token family for that user. */
  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Refresh token expired');
    }
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await this.issueTokens(stored.user);
    return { ...tokens, user: toPublicUser(stored.user) };
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!stored) return;
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await this.audit.log(stored.user, AuditAction.LOGOUT, 'User', stored.userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return {
      ...toPublicUser(user),
      clinic: {
        id: user.clinic.id,
        name: user.clinic.name,
        timezone: user.clinic.timezone,
        defaultAppointmentMinutes: user.clinic.defaultAppointmentMinutes,
      },
    };
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      clinicId: user.clinicId,
      role: user.role,
      email: user.email,
      name: user.fullName,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
  }
}
