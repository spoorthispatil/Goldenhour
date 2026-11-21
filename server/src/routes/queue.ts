import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { buildPriorityQueue } from '../services/queueService';

export const queueRouter = Router();

/**
 * GET /api/queue - the ranked priority queue.
 * Every call recomputes the ranking from current PostgreSQL state, so a newly
 * created request or a closed case is reflected on the very next poll.
 */
queueRouter.get(
  '/',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (_req, res) => {
    const payload = await buildPriorityQueue();
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  }),
);
