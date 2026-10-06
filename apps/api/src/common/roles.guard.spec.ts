import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function ctx(role: Role | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('allows any authenticated user when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctx(Role.RECEPTIONIST))).toBe(true);
  });

  it('allows a listed role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DOCTOR]);
    expect(guard.canActivate(ctx(Role.DOCTOR))).toBe(true);
  });

  it('rejects other roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DOCTOR]);
    expect(() => guard.canActivate(ctx(Role.RECEPTIONIST))).toThrow(ForbiddenException);
  });
});
