import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  AssignmentError,
  closeAssignment,
  createAssignment,
  listAssignments,
} from '../services/assignmentService';
import { emitRealtime } from '../realtime/realtime';
import { validateAssignment } from '../validation/assignment';

export const assignmentRouter = Router();

assignmentRouter.use(requireAuth, requireRole('DISPATCHER'));

/**
 * POST /api/assignments
 * Body: { requestId, ambulanceId, hospitalId }
 *
 * Reserves the ambulance and one hospital bed and marks the request ASSIGNED in
 * a single transaction with row locks.
 */
assignmentRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const validation = validateAssignment(req.body);
    if (!validation.ok) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'The assignment request is not valid.',
        errors: validation.errors,
      });
      return;
    }

    try {
      const assigned = await createAssignment(validation.value);
      emitRealtime({
        entity: 'assignment',
        action: 'created',
        requestId: assigned.requestId,
        assignmentId: assigned.assignmentId,
        hospitalId: assigned.hospitalId,
      });
      res.status(201).json({
        status: 'assigned',
        message: `Emergency ${assigned.requestId} assigned to ${assigned.ambulance.regNo} and ${assigned.hospital.name}.`,
        assignment: assigned,
      });
    } catch (error) {
      if (error instanceof AssignmentError) {
        res.status(error.status).json({
          status: 'error',
          code: error.code,
          message: error.message,
        });
        return;
      }
      // Database backstops: unique request_id or the one-open-assignment index.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        res.status(409).json({
          status: 'error',
          code: 'ALREADY_ASSIGNED',
          message:
            'That request already has an assignment, or the ambulance was taken by another dispatcher. Reload the desk and try again.',
        });
        return;
      }
      throw error;
    }
  }),
);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/assignments/:assignmentId/close
 *
 * Closes one case: the assignment gets closed_at, the request becomes CLOSED,
 * the ambulance returns to AVAILABLE and the reserved bed is released. Row
 * locks keep this serialised against new dispatches.
 */
assignmentRouter.post(
  '/:assignmentId/close',
  asyncHandler(async (req, res) => {
    const assignmentId = String(req.params.assignmentId ?? '').trim();
    if (!UUID_PATTERN.test(assignmentId)) {
      res.status(400).json({
        status: 'error',
        code: 'INVALID_ASSIGNMENT_ID',
        message: 'The assignment id must be a UUID.',
      });
      return;
    }

    try {
      const closed = await closeAssignment(assignmentId);
      emitRealtime({
        entity: 'assignment',
        action: 'closed',
        requestId: closed.requestId,
        assignmentId: closed.assignmentId,
        hospitalId: closed.hospital.hospitalId,
      });
      res.json({
        status: 'closed',
        message: `Case ${closed.requestId} closed. Ambulance ${closed.ambulance.regNo} is ${closed.ambulance.status} and ${closed.hospital.name} has ${closed.hospital.freeBeds} free beds.`,
        assignment: closed,
      });
    } catch (error) {
      if (error instanceof AssignmentError) {
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

assignmentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 20;
    const assignments = await listAssignments(limit);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ assignments, count: assignments.length });
  }),
);
