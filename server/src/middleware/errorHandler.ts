import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    message: `No route matches ${req.method} ${req.originalUrl}`,
  });
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Error) {
    return /ECONNREFUSED|can't reach database|connection refused|terminating connection/i.test(
      error.message,
    );
  }
  return false;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  console.error('[api] request failed:', message);

  if (isDatabaseUnavailable(error)) {
    res.status(503).json({
      status: 'error',
      message:
        'PostgreSQL is not reachable. Start it with `npm run db:up` and try again.',
    });
    return;
  }

  res.status(500).json({
    status: 'error',
    message: env.isProduction ? 'Internal server error' : message,
  });
}
