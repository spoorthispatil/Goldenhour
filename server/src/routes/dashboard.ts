import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  buildDispatcherDashboard,
  buildHospitalDashboard,
} from '../services/dashboardService';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/dispatcher',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (_req, res) => {
    const payload = await buildDispatcherDashboard();
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  }),
);

dashboardRouter.get(
  '/hospital',
  requireAuth,
  requireRole('HOSPITAL'),
  asyncHandler(async (req, res) => {
    // The hospital comes from the session, never from the query string, so staff
    // cannot read another hospital's incoming patients.
    const hospitalId = req.authUser?.hospitalId;
    if (!hospitalId) {
      res.status(403).json({
        status: 'error',
        code: 'NO_HOSPITAL',
        message: 'This hospital account is not linked to a hospital record.',
      });
      return;
    }

    const payload = await buildHospitalDashboard(hospitalId);
    res.setHeader('Cache-Control', 'no-store');
    if (!payload) {
      res.status(404).json({
        status: 'error',
        message: `No hospital exists with id ${hospitalId}.`,
      });
      return;
    }
    res.json(payload);
  }),
);
