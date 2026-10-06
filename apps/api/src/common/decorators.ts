import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as reachable without an access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restricts a route to the given roles. Routes without @Roles are open to any authenticated user. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** Role groups reused across controllers. */
export const CLINICAL_ROLES: Role[] = [Role.ADMIN, Role.DOCTOR, Role.THERAPIST];
export const STAFF_ROLES: Role[] = [Role.ADMIN, Role.DOCTOR, Role.THERAPIST, Role.RECEPTIONIST];
