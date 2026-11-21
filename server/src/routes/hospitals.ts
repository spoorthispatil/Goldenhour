import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { matchHospitals } from '../services/hospitalMatchService';
import { validateHospitalMatch } from '../validation/hospitalMatch';

export const hospitalRouter = Router();

/**
 * GET /api/hospitals/match?requestId=REQ-2026-0001
 * Ranked hospital readiness for one emergency (dispatcher only).
 */
hospitalRouter.get(
  '/match',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (req, res) => {
    const validation = validateHospitalMatch(req.query);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'The hospital match query is not valid.',
        errors: validation.errors,
      });
      return;
    }

    const outcome = await matchHospitals(validation.requestId);
    res.setHeader('Cache-Control', 'no-store');

    if (!outcome.ok) {
      if (outcome.reason === 'NOT_FOUND') {
        res.status(404).json({
          status: 'error',
          code: 'REQUEST_NOT_FOUND',
          message: `No emergency request exists with id ${validation.requestId}.`,
        });
        return;
      }
      res.status(409).json({
        status: 'error',
        code: 'REQUEST_CLOSED',
        message: `Emergency ${validation.requestId} is closed; hospital matching does not apply.`,
      });
      return;
    }

    res.json(outcome.payload);
  }),
);
