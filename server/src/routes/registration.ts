import { Router } from 'express';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/asyncHandler';
import { sessionCookieOptions, signSession } from '../auth/session';
import type { RegisteredUser } from '../services/registrationService';
import {
  registerDispatcher,
  registerHospital,
  registerPatient,
  RegistrationError,
} from '../services/registrationService';
import {
  validateDispatcherRegistration,
  validateHospitalRegistration,
  validatePatientRegistration,
} from '../validation/registration';

export const registrationRouter = Router();

function sendRegistered(
  res: Parameters<Parameters<typeof asyncHandler>[0]>[1],
  user: RegisteredUser,
  message: string,
) {
  const token = signSession({
    sub: user.userId,
    username: user.username,
    role: user.role,
    hospitalId: user.hospitalId,
    patientId: user.patientId,
  });
  res.cookie(env.cookieName, token, sessionCookieOptions());
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ status: 'registered', message, user });
}

/** POST /api/auth/register/hospital - creates the hospital and its first staff login. */
registrationRouter.post(
  '/hospital',
  asyncHandler(async (req, res) => {
    const validation = validateHospitalRegistration(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some hospital details need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const user = await registerHospital(validation.value);
      sendRegistered(
        res,
        user,
        `${user.hospitalName} is registered. Add your beds and stock to start matching.`,
      );
    } catch (error) {
      if (error instanceof RegistrationError) {
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

/** POST /api/auth/register/patient - creates a patient record and its login. */
registrationRouter.post(
  '/patient',
  asyncHandler(async (req, res) => {
    const validation = validatePatientRegistration(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some patient details need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const user = await registerPatient(validation.value);
      sendRegistered(
        res,
        user,
        'Patient account created. You can now call an ambulance, pre-book a bed and follow donation camps.',
      );
    } catch (error) {
      if (error instanceof RegistrationError) {
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

/** POST /api/auth/register/dispatcher - creates a dispatcher login. */
registrationRouter.post(
  '/dispatcher',
  asyncHandler(async (req, res) => {
    const validation = validateDispatcherRegistration(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Some account details need correcting.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const user = await registerDispatcher(validation.value);
      sendRegistered(res, user, 'Dispatcher account created.');
    } catch (error) {
      if (error instanceof RegistrationError) {
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
