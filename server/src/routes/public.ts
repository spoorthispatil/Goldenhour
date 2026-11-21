import { Router } from 'express';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { areaLabel } from '../services/dashboardService';
import { rankRequests } from '../services/priorityQueue';

export const publicRouter = Router();

/**
 * Public landing-page summary. Deliberately carries no patient identity:
 * callers see severity, wait time, area and aggregate counts only.
 */
publicRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const [queue, openCount, criticalCount, hospitalCount, availableAmbulances] =
      await Promise.all([
        prisma.emergencyRequest.findMany({
          where: { status: { not: 'CLOSED' } },
          select: {
            requestId: true,
            severity: true,
            status: true,
            createdAt: true,
            lat: true,
            lon: true,
          },
        }),
        prisma.emergencyRequest.count({ where: { status: { not: 'CLOSED' } } }),
        prisma.emergencyRequest.count({
          where: { status: { not: 'CLOSED' }, severity: 'CRITICAL' },
        }),
        prisma.hospital.count(),
        prisma.ambulance.count({ where: { status: 'AVAILABLE' } }),
      ]);

    // Same severity ranking as the dispatcher queue, so the landing page shows
    // the calls that would actually be served first.
    const topQueue = rankRequests(queue, now).slice(0, 3);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      generatedAt: new Date(now).toISOString(),
      stats: {
        open: openCount,
        critical: criticalCount,
        hospitals: hospitalCount,
        availableAmbulances,
      },
      queue: topQueue.map(({ item: row, waitingMinutes }) => ({
        requestId: row.requestId,
        severity: row.severity,
        area: areaLabel(row.lat, row.lon),
        waitingMinutes,
      })),
    });
  }),
);
