import { CampaignType } from '@prisma/client';
import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  markAllCampaignsRead,
  markCampaignRead,
  listPatientCampaigns,
} from '../services/campaignService';
import {
  buildPatientOverview,
  createPatientRequest,
  getPatientDeliveryProfile,
  listPatientHospitals,
  listPatientRequests,
  updatePatientDeliveryProfile,
} from '../services/patientService';
import {
  removePushSubscription,
  savePushSubscription,
} from '../services/notificationService';
import { vapidPublicKey } from '../notifications/providers';
import {
  cancelPrebooking,
  createPrebooking,
  listPatientPrebookings,
  PortalError,
} from '../services/prebookingService';
import {
  validatePatientEmergency,
  validatePatientProfile,
  validatePrebooking,
  validatePushSubscription,
} from '../validation/patient';

export const patientRouter = Router();

patientRouter.use(requireAuth, requireRole('PATIENT'));

function sessionPatient(req: { authUser?: { patientId: string | null } }): string | null {
  return req.authUser?.patientId ?? null;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof PortalError) {
    res.status(error.status).json({
      status: 'error',
      code: error.code,
      message: error.message,
    });
    return true;
  }
  return false;
}

patientRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({
        status: 'error',
        code: 'NO_PATIENT',
        message: 'This account is not linked to a patient record.',
      });
      return;
    }
    const payload = await buildPatientOverview(req.authUser!.userId, patientId);
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  }),
);

patientRouter.get(
  '/hospitals',
  asyncHandler(async (_req, res) => {
    const hospitals = await listPatientHospitals();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ hospitals, count: hospitals.length });
  }),
);

patientRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const requests = await listPatientRequests(patientId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ requests, count: requests.length });
  }),
);

patientRouter.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const validation = validatePatientEmergency(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some emergency details need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const created = await createPatientRequest(
        req.authUser!.userId,
        patientId,
        validation.value,
      );
      res.status(201).json({
        status: 'created',
        message: created.message,
        request: created,
      });
    } catch (error) {
      if (sendError(res, error)) return;
      throw error;
    }
  }),
);

patientRouter.get(
  '/prebookings',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const prebookings = await listPatientPrebookings(patientId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ prebookings, count: prebookings.length });
  }),
);

patientRouter.post(
  '/prebookings',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const validation = validatePrebooking(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some pre-booking details need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const prebooking = await createPrebooking(patientId, validation.value);
      res.status(201).json({
        status: 'created',
        message: 'Pre-booking sent. The hospital will confirm or decline it.',
        prebooking,
      });
    } catch (error) {
      if (sendError(res, error)) return;
      throw error;
    }
  }),
);

patientRouter.patch(
  '/prebookings/:prebookingId/cancel',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const rawReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (rawReason.length > 300) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Give a reason of 300 characters or fewer.',
        errors: [{ field: 'reason', message: 'Reason must be 300 characters or fewer.' }],
      });
      return;
    }

    try {
      const result = await cancelPrebooking(
        patientId,
        req.params.prebookingId,
        rawReason || null,
      );
      res.json({
        status: result.requested ? 'cancellation_requested' : 'cancelled',
        message: result.requested
          ? 'Cancellation requested. Your bed stays reserved until the hospital approves it.'
          : 'Pre-booking cancelled.',
        prebooking: result.prebooking,
      });
    } catch (error) {
      if (sendError(res, error)) return;
      throw error;
    }
  }),
);

patientRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getPatientDeliveryProfile(patientId));
  }),
);

patientRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const validation = validatePatientProfile(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some notification details need correcting.',
        errors: validation.errors,
      });
      return;
    }
    const payload = await updatePatientDeliveryProfile(patientId, validation.value);
    res.json({
      status: 'updated',
      message: 'Notification details saved.',
      ...payload,
    });
  }),
);

patientRouter.get(
  '/push/public-key',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ publicKey: vapidPublicKey() });
  }),
);

patientRouter.post(
  '/push/subscriptions',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const validation = validatePushSubscription(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'That browser subscription is not valid.',
        errors: validation.errors,
      });
      return;
    }
    const subscription = await savePushSubscription(patientId, validation.value);
    res.status(201).json({
      status: 'subscribed',
      message: 'This browser will now receive campaign push notifications.',
      subscription,
    });
  }),
);

patientRouter.delete(
  '/push/subscriptions',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
    if (!endpoint) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'The push endpoint is required.',
        errors: [{ field: 'endpoint', message: 'The push endpoint is required.' }],
      });
      return;
    }
    res.json({ status: 'unsubscribed', ...(await removePushSubscription(patientId, endpoint)) });
  }),
);

patientRouter.get(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    const rawType = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : '';
    const type = (Object.values(CampaignType) as string[]).includes(rawType)
      ? (rawType as CampaignType)
      : undefined;
    const campaigns = await listPatientCampaigns(patientId, type);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      campaigns,
      unread: campaigns.filter((campaign) => !campaign.read).length,
    });
  }),
);

patientRouter.post(
  '/campaigns/read-all',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    res.json({ status: 'read', ...(await markAllCampaignsRead(patientId)) });
  }),
);

patientRouter.post(
  '/campaigns/:campaignId/read',
  asyncHandler(async (req, res) => {
    const patientId = sessionPatient(req);
    if (!patientId) {
      res.status(403).json({ status: 'error', code: 'NO_PATIENT', message: 'No patient record.' });
      return;
    }
    try {
      res.json({ status: 'read', ...(await markCampaignRead(patientId, req.params.campaignId)) });
    } catch (error) {
      if (sendError(res, error)) return;
      throw error;
    }
  }),
);
