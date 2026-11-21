import type { FieldError } from './ambulanceSearch';
import { normaliseRequestId } from './requestId';

export interface ValidatedAssignment {
  requestId: string;
  ambulanceId: string;
  hospitalId: string;
}

export type AssignmentValidation =
  | { ok: true; value: ValidatedAssignment }
  | { ok: false; errors: FieldError[] };

const asId = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Shape validation only. Existence and eligibility (AVAILABLE ambulance, free
 * bed, QUEUED request) are checked inside the assignment transaction, where the
 * rows are locked.
 */
export function validateAssignment(body: unknown): AssignmentValidation {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const requestId = normaliseRequestId(input.requestId);
  if (!requestId) {
    errors.push({
      field: 'requestId',
      message: 'Request ID must look like REQ-2026-0001.',
    });
  }

  const ambulanceId = asId(input.ambulanceId);
  if (!ambulanceId) {
    errors.push({ field: 'ambulanceId', message: 'Select an ambulance.' });
  } else if (ambulanceId.length > 20) {
    errors.push({
      field: 'ambulanceId',
      message: 'Ambulance ID must be 20 characters or fewer.',
    });
  }

  const hospitalId = asId(input.hospitalId);
  if (!hospitalId) {
    errors.push({ field: 'hospitalId', message: 'Select a hospital.' });
  } else if (hospitalId.length > 20) {
    errors.push({
      field: 'hospitalId',
      message: 'Hospital ID must be 20 characters or fewer.',
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { requestId: requestId as string, ambulanceId, hospitalId },
  };
}
