import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../auth/middleware';
import {
  clearLoginFailures,
  loginRateLimit,
  recordLoginFailure,
} from '../auth/rateLimit';
import {
  clearedSessionCookieOptions,
  sessionCookieOptions,
  signSession,
} from '../auth/session';

export const authRouter = Router();

// Compared against when the username does not exist, so a wrong username and a
// wrong password take the same time and give the same message.
const DUMMY_HASH = bcrypt.hashSync('goldenhour-dummy-password', 10);

authRouter.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const body = req.body as { username?: unknown; password?: unknown };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Username and password are both required.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        hospital: { select: { name: true } },
        patient: { select: { name: true } },
      },
    });

    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      recordLoginFailure(req);
      res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      });
      return;
    }

    clearLoginFailures(req);

    const token = signSession({
      sub: user.userId,
      username: user.username,
      role: user.role,
      hospitalId: user.hospitalId,
      patientId: user.patientId,
    });

    res.cookie(env.cookieName, token, sessionCookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalName: user.hospital?.name ?? null,
        patientId: user.patientId,
        patientName: user.patient?.name ?? null,
      },
      sessionExpiresInSeconds: env.sessionHours * 3600,
    });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(env.cookieName, clearedSessionCookieOptions());
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: req.authUser });
});
