import type { FieldError } from './ambulanceSearch';
import { normaliseRequestId } from './requestId';

export type HospitalMatchValidation =
  | { ok: true; requestId: string }
  | { ok: false; errors: FieldError[] };

/** Hospital matching always runs for one emergency request. */
export function validateHospitalMatch(query: unknown): HospitalMatchValidation {
  const input = (query ?? {}) as Record<string, unknown>;
  const raw = typeof input.requestId === 'string' ? input.requestId : '';

  if (raw.trim() === '') {
    return {
      ok: false,
      errors: [
        { field: 'requestId', message: 'Select an emergency request to match.' },
      ],
    };
  }

  const requestId = normaliseRequestId(raw);
  if (!requestId) {
    return {
      ok: false,
      errors: [
        { field: 'requestId', message: 'Request ID must look like REQ-2026-0001.' },
      ],
    };
  }

  return { ok: true, requestId };
}
