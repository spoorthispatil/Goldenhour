import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { getDatabaseOverview } from '../services/databaseService';

export const databaseRouter = Router();

databaseRouter.get(
  '/overview',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (_req, res) => {
    const overview = await getDatabaseOverview();
    res.setHeader('Cache-Control', 'no-store');
    res.json(overview);
  }),
);
