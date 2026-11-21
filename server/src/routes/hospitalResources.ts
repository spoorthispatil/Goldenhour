import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  deleteHospitalResource,
  getHospitalResources,
  HospitalResourceError,
  importHospitalDataset,
  updateHospitalResources,
  type DeletableResourceKind,
} from '../services/hospitalResourcesService';
import { emitRealtime } from '../realtime/realtime';
import { BLOOD_GROUPS, type BloodGroup } from '../types';
import { validateHospitalDataset } from '../validation/hospitalDataset';
import { validateHospitalResources } from '../validation/hospitalResources';

export const hospitalResourceRouter = Router();

hospitalResourceRouter.use(requireAuth, requireRole('HOSPITAL'));

/** The hospital comes from the session; staff can never edit another hospital. */
function sessionHospitalId(req: { authUser?: { hospitalId: string | null } }) {
  return req.authUser?.hospitalId ?? null;
}

function sendNoHospital(res: Response) {
  res.status(403).json({
    status: 'error',
    code: 'NO_HOSPITAL',
    message: 'This hospital account is not linked to a hospital record.',
  });
}

/** Maps a service failure to a response; returns false for unexpected errors. */
function sendResourceError(res: Response, error: unknown): boolean {
  if (error instanceof HospitalResourceError) {
    res.status(error.status).json({
      status: 'error',
      code: error.code,
      message: error.message,
    });
    return true;
  }
  return false;
}

/**
 * Shared handler for both removal routes: the resource kind and the already
 * validated name are the only differences between them.
 */
async function removeResource(
  req: Request,
  res: Response,
  kind: DeletableResourceKind,
  name: string,
) {
  const hospitalId = sessionHospitalId(req);
  if (!hospitalId) {
    sendNoHospital(res);
    return;
  }

  try {
    const payload = await deleteHospitalResource(hospitalId, kind, name);
    emitRealtime({ entity: 'hospital', action: 'updated', hospitalId });
    res.json({
      ...payload,
      message: `${name} is no longer tracked for ${payload.hospital.name}. Matching no longer counts it as available.`,
    });
  } catch (error) {
    if (sendResourceError(res, error)) return;
    throw error;
  }
}

hospitalResourceRouter.get(
  '/resources',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospitalId(req);
    if (!hospitalId) {
      sendNoHospital(res);
      return;
    }

    const payload = await getHospitalResources(hospitalId);
    res.setHeader('Cache-Control', 'no-store');
    if (!payload) {
      res.status(404).json({
        status: 'error',
        code: 'HOSPITAL_NOT_FOUND',
        message: `No hospital exists with id ${hospitalId}.`,
      });
      return;
    }
    res.json(payload);
  }),
);

hospitalResourceRouter.post(
  '/resources/import',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospitalId(req);
    if (!hospitalId) {
      sendNoHospital(res);
      return;
    }

    const validation = validateHospitalDataset(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'The dataset has rows that need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const payload = await importHospitalDataset(hospitalId, validation.value);
      emitRealtime({ entity: 'hospital', action: 'updated', hospitalId });
      res.status(201).json({
        ...payload,
        message: `Dataset imported: ${payload.hospital.totalBeds} beds, ${payload.imported.bloodStock} blood groups and ${payload.imported.medicineStock} medicines.`,
      });
    } catch (error) {
      if (sendResourceError(res, error)) return;
      throw error;
    }
  }),
);

hospitalResourceRouter.delete(
  '/resources/blood/:group',
  asyncHandler(async (req, res) => {
    const group = String(req.params.group ?? '').trim().toUpperCase();
    if (!BLOOD_GROUPS.includes(group as BloodGroup)) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: `Blood group must be one of ${BLOOD_GROUPS.join(', ')}.`,
      });
      return;
    }
    await removeResource(req, res, 'blood', group);
  }),
);

hospitalResourceRouter.delete(
  '/resources/medicine/:medicine',
  asyncHandler(async (req, res) => {
    const medicine = String(req.params.medicine ?? '').trim();
    if (medicine.length < 1 || medicine.length > 80) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Medicine name must be 1-80 characters.',
      });
      return;
    }
    await removeResource(req, res, 'medicine', medicine);
  }),
);

hospitalResourceRouter.patch(
  '/resources',
  asyncHandler(async (req, res) => {
    const hospitalId = sessionHospitalId(req);
    if (!hospitalId) {
      sendNoHospital(res);
      return;
    }

    const validation = validateHospitalResources(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some resource values need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const payload = await updateHospitalResources(hospitalId, validation.value);
      emitRealtime({ entity: 'hospital', action: 'updated', hospitalId });
      res.json({
        ...payload,
        message: `Resources updated for ${payload.hospital.name}. Readiness and bed availability use these values immediately.`,
      });
    } catch (error) {
      if (sendResourceError(res, error)) return;
      throw error;
    }
  }),
);
