export const REQUEST_ID_PATTERN = /^REQ-[0-9]{4}-[0-9]{4}$/;

/** Uppercases and validates a request ID, or returns null. */
export function normaliseRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return REQUEST_ID_PATTERN.test(trimmed) ? trimmed : null;
}
