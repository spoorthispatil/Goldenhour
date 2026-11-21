import type { FieldError } from './ambulanceSearch';
import { BLOOD_GROUPS, type BloodGroup } from '../types';

export const MAX_STOCK_UNITS = 9999;
export const MAX_BLOOD_ENTRIES = 8;
export const MAX_MEDICINE_ENTRIES = 50;

export interface HospitalResourcesInput {
  freeBeds?: number;
  bloodStock?: { group: BloodGroup; units: number }[];
  medicineStock?: { medicine: string; units: number }[];
}

export type HospitalResourcesValidation =
  | { ok: true; value: HospitalResourcesInput }
  | { ok: false; errors: FieldError[] };

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Shape and range validation for hospital resource edits. Cross-record rules
 * (free beds must not exceed the hospital's total, a medicine must already be
 * tracked) are enforced in the service, where the hospital row is locked.
 */
export function validateHospitalResources(body: unknown): HospitalResourcesValidation {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const hasFreeBeds = input.freeBeds !== undefined;
  const hasBlood = input.bloodStock !== undefined;
  const hasMedicine = input.medicineStock !== undefined;
  if (!hasFreeBeds && !hasBlood && !hasMedicine) {
    errors.push({
      field: 'body',
      message: 'Provide freeBeds, bloodStock or medicineStock.',
    });
    return { ok: false, errors };
  }

  let freeBeds: number | undefined;
  if (hasFreeBeds) {
    const value = asNumber(input.freeBeds);
    if (input.freeBeds === null || !Number.isFinite(value)) {
      errors.push({ field: 'freeBeds', message: 'Free beds must be a number.' });
    } else if (!Number.isInteger(value)) {
      errors.push({ field: 'freeBeds', message: 'Free beds must be a whole number.' });
    } else if (value < 0) {
      errors.push({ field: 'freeBeds', message: 'Free beds cannot be negative.' });
    } else {
      freeBeds = value;
    }
  }

  let bloodStock: HospitalResourcesInput['bloodStock'];
  if (hasBlood) {
    if (!Array.isArray(input.bloodStock)) {
      errors.push({ field: 'bloodStock', message: 'Blood stock must be a list.' });
    } else if (input.bloodStock.length > MAX_BLOOD_ENTRIES) {
      errors.push({
        field: 'bloodStock',
        message: `At most ${MAX_BLOOD_ENTRIES} blood groups can be sent.`,
      });
    } else {
      const seen = new Set<string>();
      const parsed: { group: BloodGroup; units: number }[] = [];
      input.bloodStock.forEach((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const rawGroup = asText(row.group).toUpperCase();
        const group = BLOOD_GROUPS.find((value) => value === rawGroup);
        const units = asNumber(row.units);
        const field = `bloodStock[${rawGroup || index}]`;

        if (!group) {
          errors.push({
            field,
            message: `Blood group must be one of ${BLOOD_GROUPS.join(', ')}.`,
          });
          return;
        }
        if (seen.has(group)) {
          errors.push({ field, message: `${group} appears more than once.` });
          return;
        }
        seen.add(group);

        if (!Number.isFinite(units) || !Number.isInteger(units)) {
          errors.push({ field, message: `${group} units must be a whole number.` });
          return;
        }
        if (units < 0 || units > MAX_STOCK_UNITS) {
          errors.push({
            field,
            message: `${group} units must be between 0 and ${MAX_STOCK_UNITS}.`,
          });
          return;
        }
        parsed.push({ group, units });
      });
      bloodStock = parsed;
    }
  }

  let medicineStock: HospitalResourcesInput['medicineStock'];
  if (hasMedicine) {
    if (!Array.isArray(input.medicineStock)) {
      errors.push({
        field: 'medicineStock',
        message: 'Medicine stock must be a list.',
      });
    } else if (input.medicineStock.length > MAX_MEDICINE_ENTRIES) {
      errors.push({
        field: 'medicineStock',
        message: `At most ${MAX_MEDICINE_ENTRIES} medicines can be sent.`,
      });
    } else {
      const seen = new Set<string>();
      const parsed: { medicine: string; units: number }[] = [];
      input.medicineStock.forEach((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const medicine = asText(row.medicine);
        const units = asNumber(row.units);
        const field = `medicineStock[${medicine || index}]`;

        if (medicine.length < 3 || medicine.length > 80) {
          errors.push({
            field,
            message: 'Medicine name must be 3-80 characters.',
          });
          return;
        }
        const key = medicine.toLowerCase();
        if (seen.has(key)) {
          errors.push({ field, message: `${medicine} appears more than once.` });
          return;
        }
        seen.add(key);

        if (!Number.isFinite(units) || !Number.isInteger(units)) {
          errors.push({
            field,
            message: `${medicine} units must be a whole number.`,
          });
          return;
        }
        if (units < 0 || units > MAX_STOCK_UNITS) {
          errors.push({
            field,
            message: `${medicine} units must be between 0 and ${MAX_STOCK_UNITS}.`,
          });
          return;
        }
        parsed.push({ medicine, units });
      });
      medicineStock = parsed;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, value: { freeBeds, bloodStock, medicineStock } };
}
