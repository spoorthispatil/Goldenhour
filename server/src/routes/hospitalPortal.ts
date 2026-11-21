import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createCampaign,
  listHospitalCampaigns,
} from '../services/campaignService';
import {
  campaignDeliveryReport,
  dispatchCampaign,
} from '../services/notificationService';
import {
  decidePrebooking,
  listHospitalPrebookings,
  PortalError,
} from '../services/prebookingService';
import { validateCampaign, validatePrebookingDecision } from '../validation/patient';

export const hospitalPortalRouter = Router();

hospitalPortalRouter.use(requireAuth, requireRole('HOSPITAL'));

function sessionHospital(req: { authUser?: { hospitalId: string | null } }): string | null {
  return req.authUser?.hospitalId ?? null;
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

hospitalPortalRouter.get(
  '/prebookings',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospital(req);
    if (!hospitalId) {
      res.status(403).json({ status: 'error', code: 'NO_HOSPITAL', message: 'No hospital.' });
      return;
    }
    const prebookings = await listHospitalPrebookings(hospitalId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ prebookings, count: prebookings.length });
  }),
);

hospitalPortalRouter.patch(
  '/prebookings/:prebookingId',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospital(req);
    if (!hospitalId) {
      res.status(403).json({ status: 'error', code: 'NO_HOSPITAL', message: 'No hospital.' });
      return;
    }
    const validation = validatePrebookingDecision(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Choose a valid pre-booking action.',
        errors: validation.errors,
      });
      return;
    }

    const messages: Record<string, string> = {
      CONFIRM: 'Pre-booking confirmed and one bed reserved.',
      DECLINE: 'Pre-booking declined.',
      ADMIT: 'Patient admitted. The reserved bed is now occupied.',
      DISCHARGE: 'Patient discharged and the bed released.',
      APPROVE_CANCELLATION: 'Cancellation approved and the bed released.',
      REJECT_CANCELLATION:
        'Cancellation request rejected. The bed stays reserved for the patient.',
    };

    try {
      const prebooking = await decidePrebooking(
        hospitalId,
        req.params.prebookingId,
        validation.value.action,
      );
      res.json({
        status: 'updated',
        message: messages[validation.value.action],
        prebooking,
      });
    } catch (error) {
      if (sendError(res, error)) return;
      throw error;
    }
  }),
);

hospitalPortalRouter.get(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospital(req);
    if (!hospitalId) {
      res.status(403).json({ status: 'error', code: 'NO_HOSPITAL', message: 'No hospital.' });
      return;
    }
    const campaigns = await listHospitalCampaigns(hospitalId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ campaigns, count: campaigns.length });
  }),
);

hospitalPortalRouter.post(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospital(req);
    if (!hospitalId) {
      res.status(403).json({ status: 'error', code: 'NO_HOSPITAL', message: 'No hospital.' });
      return;
    }
    const validation = validateCampaign(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some campaign details need correcting.',
        errors: validation.errors,
      });
      return;
    }

    const campaign = await createCampaign(
      hospitalId,
      req.authUser!.userId,
      validation.value,
    );
    const delivery = await dispatchCampaign(campaign.campaignId);
    res.status(201).json({
      status: 'created',
      message:
        validation.value.channels.length === 0
          ? 'Campaign published to the in-app notification feed.'
          : `Campaign published. ${delivery.sent} message(s) accepted, ${delivery.skipped} skipped and ${delivery.failed} failed.`,
      campaign,
      delivery,
    });
  }),
);

hospitalPortalRouter.get(
  '/campaigns/:campaignId/delivery',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospital(req);
    if (!hospitalId) {
      res.status(403).json({ status: 'error', code: 'NO_HOSPITAL', message: 'No hospital.' });
      return;
    }
    try {
      const report = await campaignDeliveryReport(hospitalId, req.params.campaignId);
      res.setHeader('Cache-Control', 'no-store');
      res.json(report);
    } catch (error) {
      if (sendError(res, error)) return;
      throw error;
    }
  }),
);
