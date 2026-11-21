import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { clearedSessionCookieOptions, verifySession } from './session';
import './types';

/**
 * Reads the HTTP-only session cookie, verifies the JWT, then re-reads the user
 * from PostgreSQL so a deleted or re-assigned account cannot keep working on an
 * old token.
 */
export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[env.cookieName];

    if (!token) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Sign in to use the GoldenHour console.',
      });
      return;
    }

    const payload = verifySession(token);
    if (!payload) {
      res.clearCookie(env.cookieName, clearedSessionCookieOptions());
      res.status(401).json({
        status: 'error',
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { userId: payload.sub },
      include: {
        hospital: { select: { name: true } },
        patient: { select: { name: true } },
      },
    });

    if (!user) {
      res.clearCookie(env.cookieName, clearedSessionCookieOptions());
      res.status(401).json({
        status: 'error',
        code: 'ACCOUNT_MISSING',
        message: 'This account no longer exists.',
      });
      return;
    }

    req.authUser = {
      userId: user.userId,
      username: user.username,
      role: user.role,
      hospitalId: user.hospitalId,
      hospitalName: user.hospital?.name ?? null,
      patientId: user.patientId,
      patientName: user.patient?.name ?? null,
    };

    next();
  },
);

/** Role guard: a hospital account can never reach dispatcher routes. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Sign in to use the GoldenHour console.',
      });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message:
          user.role === 'HOSPITAL'
            ? 'This area belongs to dispatchers. Hospital staff can only open their own dashboard.'
            : user.role === 'PATIENT'
              ? 'This area belongs to staff. Patients can only open the patient portal.'
              : 'This area belongs to hospital staff. Dispatchers cannot open it.',
      });
      return;
    }
    next();
  };
}
