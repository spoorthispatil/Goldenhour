import type { FieldError } from './ambulanceSearch';
import { BLOOD_GROUPS, type BloodGroup } from '../types';

export interface HospitalRegistrationInput {
  hospitalName: string;
  lat: number;
  lon: number;
  totalBeds: number;
  username: string;
  password: string;
}

export interface DispatcherRegistrationInput {
  username: string;
  password: string;
}

export interface PatientRegistrationInput {
  name: string;
  age: number;
  contact: string;
  username: string;
  password: string;
  /// Optional notification details; the patient can add or change them later
  /// from the notifications page.
  email: string | null;
  city: string | null;
  bloodGroup: BloodGroup | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldError[] };

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,60}$/;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function usernameErrors(username: string): FieldError[] {
  if (!username) {
    return [{ field: 'username', message: 'Username is required.' }];
  }
  if (!USERNAME_PATTERN.test(username)) {
    return [
      {
        field: 'username',
        message: 'Use 3-60 letters, numbers, dots, dashes or underscores.',
      },
    ];
  }
  return [];
}

function passwordErrors(password: string): FieldError[] {
  if (!password) return [{ field: 'password', message: 'Password is required.' }];
  if (password.length < 8) {
    return [{ field: 'password', message: 'Password must be at least 8 characters.' }];
  }
  if (password.length > 72) {
    return [{ field: 'password', message: 'Password must be 72 characters or fewer.' }];
  }
  return [];
}

export function validateHospitalRegistration(
  body: unknown,
): ValidationResult<HospitalRegistrationInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const hospitalName = asText(input.hospitalName);
  if (hospitalName.length < 2) {
    errors.push({
      field: 'hospitalName',
      message: 'Hospital name must be at least 2 characters.',
    });
  } else if (hospitalName.length > 120) {
    errors.push({
      field: 'hospitalName',
      message: 'Hospital name must be 120 characters or fewer.',
    });
  }

  const lat = asNumber(input.lat);
  const lon = asNumber(input.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push({ field: 'lat', message: 'Latitude must be between -90 and 90.' });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.push({
      field: 'lon',
      message: 'Longitude must be between -180 and 180.',
    });
  }

  const totalBeds = asNumber(input.totalBeds);
  if (!Number.isInteger(totalBeds) || totalBeds < 1 || totalBeds > 20_000) {
    errors.push({
      field: 'totalBeds',
      message: 'Total beds must be a whole number between 1 and 20000.',
    });
  }

  const username = asText(input.username);
  const password = typeof input.password === 'string' ? input.password : '';
  errors.push(...usernameErrors(username), ...passwordErrors(password));

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { hospitalName, lat, lon, totalBeds, username, password },
  };
}

export function validatePatientRegistration(
  body: unknown,
): ValidationResult<PatientRegistrationInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const name = asText(input.name);
  if (name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters.' });
  } else if (name.length > 100) {
    errors.push({ field: 'name', message: 'Name must be 100 characters or fewer.' });
  }

  const age = asNumber(input.age);
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    errors.push({ field: 'age', message: 'Age must be a whole number from 0 to 120.' });
  }

  const contact = asText(input.contact);
  if (!/^[0-9]{10}$/.test(contact)) {
    errors.push({ field: 'contact', message: 'Contact must be exactly 10 digits.' });
  }

  const rawEmail = asText(input.email);
  if (rawEmail && (rawEmail.length > 160 || !EMAIL_PATTERN.test(rawEmail))) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  const rawCity = asText(input.city);
  if (rawCity && (rawCity.length < 2 || rawCity.length > 80)) {
    errors.push({ field: 'city', message: 'City must be 2-80 characters.' });
  }

  const rawBloodGroup = asText(input.bloodGroup).toUpperCase();
  const bloodGroup = rawBloodGroup
    ? BLOOD_GROUPS.find((group) => group === rawBloodGroup) ?? null
    : null;
  if (rawBloodGroup && !bloodGroup) {
    errors.push({
      field: 'bloodGroup',
      message: `Blood group must be one of ${BLOOD_GROUPS.join(', ')}.`,
    });
  }

  const username = asText(input.username);
  const password = typeof input.password === 'string' ? input.password : '';
  errors.push(...usernameErrors(username), ...passwordErrors(password));

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      age,
      contact,
      username,
      password,
      email: rawEmail || null,
      city: rawCity || null,
      bloodGroup,
    },
  };
}

export function validateDispatcherRegistration(
  body: unknown,
): ValidationResult<DispatcherRegistrationInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const username = asText(input.username);
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = [...usernameErrors(username), ...passwordErrors(password)];
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { username, password } };
}
