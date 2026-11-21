import type { UserRole } from '@prisma/client';

export interface AuthUser {
  userId: string;
  username: string;
  role: UserRole;
  hospitalId: string | null;
  hospitalName: string | null;
  patientId: string | null;
  patientName: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}
