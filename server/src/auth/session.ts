import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';

export interface SessionPayload {
  sub: string;
  username: string;
  role: UserRole;
  hospitalId: string | null;
  patientId?: string | null;
}

const ISSUER = 'goldenhour';

/** Sessions last eight hours. */
export const SESSION_SECONDS = env.sessionHours * 60 * 60;

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: SESSION_SECONDS,
    issuer: ISSUER,
    algorithm: 'HS256',
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string') return null;
    const { sub, username, role, hospitalId, patientId } = decoded as jwt.JwtPayload &
      Partial<SessionPayload>;
    if (
      !sub ||
      !username ||
      (role !== 'DISPATCHER' && role !== 'HOSPITAL' && role !== 'PATIENT')
    ) {
      return null;
    }
    return {
      sub,
      username,
      role,
      hospitalId: hospitalId ?? null,
      patientId: patientId ?? null,
    };
  } catch {
    // Expired, tampered with or signed with another secret.
    return null;
  }
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true, // JavaScript can never read the token
    sameSite: 'lax',
    secure: env.isProduction, // HTTPS only outside development
    path: '/',
    maxAge: SESSION_SECONDS * 1000,
  };
}

/** Clear the cookie with matching attributes; Express sets the expiry itself. */
export function clearedSessionCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  return options;
}
