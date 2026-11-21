import { AmbulanceStatus } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  AmbulanceError,
  createAmbulance,
  listFleet,
  searchNearbyAmbulances,
} from '../services/ambulanceService';
import { validateAmbulanceSearch } from '../validation/ambulanceSearch';

export const ambulanceRouter = Router();

/**
 * GET /api/ambulances/search?requestId=REQ-2026-0001&limit=5
 * GET /api/ambulances/search?lat=15.37&lon=75.10
 *
 * Nearest AVAILABLE ambulances to the emergency, by Haversine distance.
 */
/** GET /api/ambulances - the whole fleet, for fleet management. */
ambulanceRouter.get(
  '/',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (_req, res) => {
    const fleet = await listFleet();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ fleet, count: fleet.length });
  }),
);

/** POST /api/ambulances - add a vehicle; the fleet starts empty. */
ambulanceRouter.post(
  '/',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const regNo =
      typeof body.regNo === 'string' ? body.regNo.trim().toUpperCase() : '';
    const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat);
    const lon = typeof body.lon === 'number' ? body.lon : Number(body.lon);
    const rawStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';
    const status = (Object.values(AmbulanceStatus) as string[]).includes(rawStatus)
      ? (rawStatus as AmbulanceStatus)
      : undefined;

    const errors: { field: string; message: string }[] = [];
    // Matches the database CHECK constraint, so bad formats get a 400 not a 500.
    if (!/^[A-Z]{2}-[0-9]{2}-[A-Z]{1,3}-[0-9]{4}$/.test(regNo)) {
      errors.push({
        field: 'regNo',
        message: 'Use a registration like KA-25-AB-4821.',
      });
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.push({ field: 'lat', message: 'Latitude must be between -90 and 90.' });
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      errors.push({ field: 'lon', message: 'Longitude must be between -180 and 180.' });
    }
    if (rawStatus && !status) {
      errors.push({
        field: 'status',
        message: 'Status must be AVAILABLE, BUSY or OFFLINE.',
      });
    }
    if (errors.length > 0) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'The ambulance details need correcting.',
        errors,
      });
      return;
    }

    try {
      const ambulance = await createAmbulance({ regNo, lat, lon, status });
      res.status(201).json({
        status: 'created',
        message: `Ambulance ${ambulance.regNo} added to the fleet.`,
        ambulance,
      });
    } catch (error) {
      if (error instanceof AmbulanceError) {
        res.status(error.status).json({
          status: 'error',
          code: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }),
);

ambulanceRouter.get(
  '/search',
  requireAuth,
  requireRole('DISPATCHER'),
  asyncHandler(async (req, res) => {
    const validation = validateAmbulanceSearch(req.query);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'The ambulance search query is not valid.',
        errors: validation.errors,
      });
      return;
    }

    const outcome = await searchNearbyAmbulances(validation.value);
    res.setHeader('Cache-Control', 'no-store');

    if (!outcome.ok) {
      if (outcome.reason === 'NOT_FOUND') {
        res.status(404).json({
          status: 'error',
          code: 'REQUEST_NOT_FOUND',
          message: `No emergency request exists with id ${validation.value.requestId}.`,
        });
        return;
      }
      res.status(409).json({
        status: 'error',
        code: 'REQUEST_CLOSED',
        message: `Emergency ${validation.value.requestId} is closed; no ambulance search is needed.`,
      });
      return;
    }

    res.json(outcome.payload);
  }),
);
