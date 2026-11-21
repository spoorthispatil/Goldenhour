import { RequestStatus, Severity } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createEmergencyRequest,
  listEmergencyRequests,
} from '../services/emergencyService';
import { emitRealtime } from '../realtime/realtime';
import { validateEmergencyRequest } from '../validation/emergency';

export const emergencyRequestRouter = Router();

emergencyRequestRouter.use(requireAuth, requireRole('DISPATCHER'));

emergencyRequestRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const validation = validateEmergencyRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some details need correcting before this emergency can be queued.',
        errors: validation.errors,
      });
      return;
    }

    const created = await createEmergencyRequest(
      validation.value,
      req.authUser!.userId,
    );

    emitRealtime({
      entity: 'emergency',
      action: 'created',
      requestId: created.requestId,
      severity: created.severity,
    });

    res.status(201).json({
      status: 'created',
      message: `Emergency ${created.requestId} queued for ${created.patient.name}.`,
      request: created,
    });
  }),
);

emergencyRequestRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const limitParam = Number(req.query.limit);
    const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;

    const rawStatus = typeof req.query.status === 'string' ? req.query.status : '';
    const rawSeverity =
      typeof req.query.severity === 'string' ? req.query.severity.toUpperCase() : '';

    const status = (Object.values(RequestStatus) as string[]).includes(rawStatus)
      ? (rawStatus as RequestStatus)
      : undefined;
    const severity = (Object.values(Severity) as string[]).includes(rawSeverity)
      ? (rawSeverity as Severity)
      : undefined;

    const requests = await listEmergencyRequests({ status, severity, limit });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ requests, count: requests.length });
  }),
);
