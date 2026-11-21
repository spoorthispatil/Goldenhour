import { BLOOD_GROUPS, type BloodGroup } from '../types';
import { MAX_STOCK_UNITS } from './hospitalResources';
import type { FieldError } from './ambulanceSearch';

export const MAX_DATASET_MEDICINES = 50;
export const MAX_TOTAL_BEDS = 20000;

export interface HospitalDatasetInput {
  totalBeds: number;
  freeBeds: number;
  bloodStock: { group: BloodGroup; units: number }[];
  medicineStock: { medicine: string; units: number }[];
}

export type HospitalDatasetValidation =
  | { ok: true; value: HospitalDatasetInput }
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
 * Validates one complete hospital dataset. Crossing rules (free beds within the
 * new total) are checked here as well as in the service, because an import
 * replaces the whole dataset.
 */
export function validateHospitalDataset(body: unknown): HospitalDatasetValidation {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const totalBeds = asNumber(input.totalBeds);
  if (!Number.isInteger(totalBeds) || totalBeds < 1 || totalBeds > MAX_TOTAL_BEDS) {
    errors.push({
      field: 'totalBeds',
      message: `Total beds must be a whole number between 1 and ${MAX_TOTAL_BEDS}.`,
    });
  }

  const freeBeds = asNumber(input.freeBeds);
  if (!Number.isInteger(freeBeds) || freeBeds < 0) {
    errors.push({
      field: 'freeBeds',
      message: 'Free beds must be a whole number, 0 or more.',
    });
  } else if (Number.isInteger(totalBeds) && freeBeds > totalBeds) {
    errors.push({
      field: 'freeBeds',
      message: 'Free beds cannot exceed total beds.',
    });
  }

  const rawBlood = input.bloodStock ?? [];
  const bloodStock: { group: BloodGroup; units: number }[] = [];
  if (!Array.isArray(rawBlood)) {
    errors.push({ field: 'bloodStock', message: 'Blood stock must be a list.' });
  } else if (rawBlood.length > BLOOD_GROUPS.length) {
    errors.push({
      field: 'bloodStock',
      message: `At most ${BLOOD_GROUPS.length} blood groups can be imported.`,
    });
  } else {
    const seen = new Set<string>();
    rawBlood.forEach((entry, index) => {
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
      if (!Number.isInteger(units) || units < 0 || units > MAX_STOCK_UNITS) {
        errors.push({
          field,
          message: `${group} units must be between 0 and ${MAX_STOCK_UNITS}.`,
        });
        return;
      }
      bloodStock.push({ group, units });
    });
  }

  const rawMedicine = input.medicineStock ?? [];
  const medicineStock: { medicine: string; units: number }[] = [];
  if (!Array.isArray(rawMedicine)) {
    errors.push({
      field: 'medicineStock',
      message: 'Medicine stock must be a list.',
    });
  } else if (rawMedicine.length > MAX_DATASET_MEDICINES) {
    errors.push({
      field: 'medicineStock',
      message: `At most ${MAX_DATASET_MEDICINES} medicines can be imported.`,
    });
  } else {
    const seen = new Set<string>();
    rawMedicine.forEach((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const medicine = asText(row.medicine);
      const units = asNumber(row.units);
      const field = `medicineStock[${medicine || index}]`;

      if (medicine.length < 3 || medicine.length > 80) {
        errors.push({ field, message: 'Medicine name must be 3-80 characters.' });
        return;
      }
      const key = medicine.toLowerCase();
      if (seen.has(key)) {
        errors.push({ field, message: `${medicine} appears more than once.` });
        return;
      }
      seen.add(key);
      if (!Number.isInteger(units) || units < 0 || units > MAX_STOCK_UNITS) {
        errors.push({
          field,
          message: `${medicine} units must be between 0 and ${MAX_STOCK_UNITS}.`,
        });
        return;
      }
      medicineStock.push({ medicine, units });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      totalBeds,
      freeBeds,
      bloodStock,
      medicineStock,
    },
  };
}
