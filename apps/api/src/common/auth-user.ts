import { Role } from '@prisma/client';

/** The authenticated principal attached to every protected request. */
export interface AuthUser {
  id: string;
  clinicId: string;
  role: Role;
  email: string;
  fullName: string;
}

export interface JwtPayload {
  sub: string;
  clinicId: string;
  role: Role;
  email: string;
  name: string;
}
