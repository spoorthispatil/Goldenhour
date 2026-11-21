import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

interface AttemptRecord {
  failures: number;
  blockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();

const keyFor = (req: Request): string => {
  const username =
    typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  return `${req.ip ?? 'unknown'}|${username}`;
};

/** Blocks a username/IP pair for 15 minutes after five failed attempts. */
export function loginRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = keyFor(req);
  const record = attempts.get(key);
  const now = Date.now();

  if (record && record.blockedUntil > now) {
    const seconds = Math.ceil((record.blockedUntil - now) / 1000);
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      status: 'error',
      code: 'RATE_LIMITED',
      message: `Too many failed sign-in attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).`,
    });
    return;
  }

  if (record && record.blockedUntil !== 0 && record.blockedUntil <= now) {
    attempts.delete(key);
  }

  next();
}

export function recordLoginFailure(req: Request): void {
  const key = keyFor(req);
  const existing = attempts.get(key) ?? { failures: 0, blockedUntil: 0 };
  const failures = existing.failures + 1;

  attempts.set(key, {
    failures,
    blockedUntil: failures >= MAX_FAILURES ? Date.now() + WINDOW_MS : 0,
  });
}

export function clearLoginFailures(req: Request): void {
  attempts.delete(keyFor(req));
}
