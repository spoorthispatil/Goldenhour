import { REQUEST_ID_PATTERN } from './requestId';

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidatedAmbulanceSearch {
  requestId: string | null;
  lat: number | null;
  lon: number | null;
  limit: number;
}

type ValidationResult =
  | { ok: true; value: ValidatedAmbulanceSearch }
  | { ok: false; errors: FieldError[] };

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

/**
 * A search is anchored either at an emergency request (the normal dispatcher
 * flow) or at explicit coordinates (manual lookup). Exactly one anchor is
 * accepted, so the distance origin is never ambiguous.
 */
export function validateAmbulanceSearch(query: unknown): ValidationResult {
  const input = (query ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const rawRequestId = asText(input.requestId).toUpperCase();
  const hasRequestId = rawRequestId !== '';
  const hasCoordinates = asText(input.lat) !== '' || asText(input.lon) !== '';

  let requestId: string | null = null;
  const anchorConflict = hasRequestId && hasCoordinates;

  if (anchorConflict) {
    // One clear message instead of a cascade of coordinate errors.
    errors.push({
      field: 'requestId',
      message: 'Search by emergency request or by coordinates, not both.',
    });
  } else if (hasRequestId) {
    if (!REQUEST_ID_PATTERN.test(rawRequestId)) {
      errors.push({
        field: 'requestId',
        message: 'Request ID must look like REQ-2026-0001.',
      });
    } else {
      requestId = rawRequestId;
    }
  } else if (!hasCoordinates) {
    errors.push({
      field: 'requestId',
      message: 'Select an emergency request or provide latitude and longitude.',
    });
  }

  let lat: number | null = null;
  let lon: number | null = null;
  if (!hasRequestId && hasCoordinates) {
    const latValue = asNumber(input.lat);
    const lonValue = asNumber(input.lon);
    if (!Number.isFinite(latValue)) {
      errors.push({ field: 'lat', message: 'Latitude is required.' });
    } else if (latValue < -90 || latValue > 90) {
      errors.push({ field: 'lat', message: 'Latitude must be between -90 and 90.' });
    } else {
      lat = latValue;
    }
    if (!Number.isFinite(lonValue)) {
      errors.push({ field: 'lon', message: 'Longitude is required.' });
    } else if (lonValue < -180 || lonValue > 180) {
      errors.push({
        field: 'lon',
        message: 'Longitude must be between -180 and 180.',
      });
    } else {
      lon = lonValue;
    }
  }

  const rawLimit = asText(input.limit);
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== '') {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      errors.push({
        field: 'limit',
        message: `Limit must be a whole number between 1 and ${MAX_LIMIT}.`,
      });
    } else {
      limit = parsed;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, value: { requestId, lat, lon, limit } };
}
