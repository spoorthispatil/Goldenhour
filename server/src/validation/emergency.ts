import { Severity } from '@prisma/client';

export const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

export type BloodGroupValue = (typeof BLOOD_GROUPS)[number];

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidatedEmergencyInput {
  patientName: string;
  patientAge: number;
  contact: string;
  lat: number;
  lon: number;
  severity: Severity;
  bloodGroupNeeded: BloodGroupValue | null;
  medicineNeeded: string | null;
}

type ValidationResult =
  | { ok: true; value: ValidatedEmergencyInput }
  | { ok: false; errors: FieldError[] };

const SEVERITIES: Severity[] = [
  Severity.CRITICAL,
  Severity.HIGH,
  Severity.MEDIUM,
  Severity.LOW,
];

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

/**
 * Server-side intake validation. The frontend mirrors these rules for quick
 * feedback, but this is the authoritative check - the database CHECK constraints
 * are the final line of defence.
 */
export function validateEmergencyRequest(body: unknown): ValidationResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const patientName = asText(input.patientName);
  if (!patientName) {
    errors.push({ field: 'patientName', message: 'Patient name is required.' });
  } else if (patientName.length < 2) {
    errors.push({
      field: 'patientName',
      message: 'Patient name must be at least 2 characters.',
    });
  } else if (patientName.length > 100) {
    errors.push({
      field: 'patientName',
      message: 'Patient name must be 100 characters or fewer.',
    });
  }

  const rawAge = input.patientAge;
  const patientAge = asNumber(rawAge);
  if (rawAge === undefined || rawAge === null || rawAge === '') {
    errors.push({ field: 'patientAge', message: 'Age is required.' });
  } else if (!Number.isInteger(patientAge)) {
    errors.push({ field: 'patientAge', message: 'Age must be a whole number.' });
  } else if (patientAge < 0 || patientAge > 120) {
    errors.push({ field: 'patientAge', message: 'Age must be between 0 and 120.' });
  }

  const contact = asText(input.contact);
  if (!contact) {
    errors.push({ field: 'contact', message: 'Contact number is required.' });
  } else if (!/^[0-9]{10}$/.test(contact)) {
    errors.push({
      field: 'contact',
      message: 'Contact number must be exactly 10 digits.',
    });
  }

  const lat = asNumber(input.lat);
  const lon = asNumber(input.lon);
  if (!Number.isFinite(lat)) {
    errors.push({ field: 'lat', message: 'Latitude is required.' });
  } else if (lat < -90 || lat > 90) {
    errors.push({ field: 'lat', message: 'Latitude must be between -90 and 90.' });
  }
  if (!Number.isFinite(lon)) {
    errors.push({ field: 'lon', message: 'Longitude is required.' });
  } else if (lon < -180 || lon > 180) {
    errors.push({
      field: 'lon',
      message: 'Longitude must be between -180 and 180.',
    });
  }

  const rawSeverity = asText(input.severity).toUpperCase();
  const severity = SEVERITIES.find((value) => value === rawSeverity);
  if (!rawSeverity) {
    errors.push({ field: 'severity', message: 'Severity is required.' });
  } else if (!severity) {
    errors.push({
      field: 'severity',
      message: 'Severity must be CRITICAL, HIGH, MEDIUM or LOW.',
    });
  }

  const rawBlood = asText(input.bloodGroupNeeded);
  const bloodGroupNeeded = rawBlood
    ? BLOOD_GROUPS.find((group) => group === rawBlood) ?? null
    : null;
  if (rawBlood && !bloodGroupNeeded) {
    errors.push({
      field: 'bloodGroupNeeded',
      message: `Blood group must be one of ${BLOOD_GROUPS.join(', ')}.`,
    });
  }

  const rawMedicine = asText(input.medicineNeeded);
  let medicineNeeded: string | null = null;
  if (rawMedicine) {
    if (rawMedicine.length < 3) {
      errors.push({
        field: 'medicineNeeded',
        message: 'Medicine name must be at least 3 characters.',
      });
    } else if (rawMedicine.length > 80) {
      errors.push({
        field: 'medicineNeeded',
        message: 'Medicine name must be 80 characters or fewer.',
      });
    } else {
      medicineNeeded = rawMedicine;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      patientName,
      patientAge,
      contact,
      lat,
      lon,
      severity: severity as Severity,
      bloodGroupNeeded,
      medicineNeeded,
    },
  };
}
