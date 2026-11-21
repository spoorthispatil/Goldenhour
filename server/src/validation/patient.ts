import {
  CampaignAudience,
  CampaignType,
  NotificationChannel,
  PrebookingStatus,
  Severity,
} from '@prisma/client';
import type { FieldError } from './ambulanceSearch';
import { BLOOD_GROUPS, type BloodGroup } from '../types';

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldError[] };

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

export interface PatientEmergencyInput {
  lat: number;
  lon: number;
  severity: Severity;
  bloodGroupNeeded: BloodGroup | null;
  medicineNeeded: string | null;
}

/** Patient-initiated calls only choose the emergency details; identity comes
 * from the signed-in patient record, never from the request body. */
export function validatePatientEmergency(body: unknown): Result<PatientEmergencyInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const lat = asNumber(input.lat);
  const lon = asNumber(input.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push({ field: 'lat', message: 'Latitude must be between -90 and 90.' });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.push({ field: 'lon', message: 'Longitude must be between -180 and 180.' });
  }

  const rawSeverity = asText(input.severity).toUpperCase();
  const severity = (Object.values(Severity) as string[]).includes(rawSeverity)
    ? (rawSeverity as Severity)
    : null;
  if (!severity) {
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
    if (rawMedicine.length < 3 || rawMedicine.length > 80) {
      errors.push({
        field: 'medicineNeeded',
        message: 'Medicine name must be 3-80 characters.',
      });
    } else {
      medicineNeeded = rawMedicine;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      lat,
      lon,
      severity: severity as Severity,
      bloodGroupNeeded,
      medicineNeeded,
    },
  };
}

export interface PrebookingInput {
  hospitalId: string;
  reason: string;
  slotStart: Date;
}

/** A pre-booking reserves a one-hour slot; the client sends the start instant. */
export const PREBOOKING_SLOT_MINUTES = 60;
const SLOT_MIN_LEAD_MINUTES = 15;
const SLOT_MAX_DAYS = 30;

export function validatePrebooking(body: unknown): Result<PrebookingInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const hospitalId = asText(input.hospitalId);
  if (!hospitalId || hospitalId.length > 20) {
    errors.push({ field: 'hospitalId', message: 'Choose a hospital.' });
  }

  const reason = asText(input.reason);
  if (reason.length > 300) {
    errors.push({ field: 'reason', message: 'Reason must be 300 characters or fewer.' });
  }

  const rawSlot = asText(input.slotStart);
  const slotStart = new Date(rawSlot);
  const now = Date.now();
  if (!rawSlot || Number.isNaN(slotStart.getTime())) {
    errors.push({ field: 'slotStart', message: 'Choose the date and time slot you want.' });
  } else if (
    slotStart.getMinutes() !== 0 ||
    slotStart.getSeconds() !== 0 ||
    slotStart.getMilliseconds() !== 0
  ) {
    errors.push({ field: 'slotStart', message: 'Time slots start on the hour.' });
  } else if (slotStart.getTime() < now + SLOT_MIN_LEAD_MINUTES * 60_000) {
    errors.push({
      field: 'slotStart',
      message: `Choose a slot at least ${SLOT_MIN_LEAD_MINUTES} minutes from now.`,
    });
  } else if (slotStart.getTime() > now + SLOT_MAX_DAYS * 86_400_000) {
    errors.push({
      field: 'slotStart',
      message: `Choose a slot within the next ${SLOT_MAX_DAYS} days.`,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { hospitalId, reason, slotStart } };
}

export interface CampaignInput {
  type: CampaignType;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  audience: CampaignAudience;
  audienceValue: string | null;
  channels: NotificationChannel[];
}

const ALL_CHANNELS: NotificationChannel[] = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
];

export function validateCampaign(body: unknown): Result<CampaignInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const rawType = asText(input.type).toUpperCase();
  const type = (Object.values(CampaignType) as string[]).includes(rawType)
    ? (rawType as CampaignType)
    : null;
  if (!type) {
    errors.push({
      field: 'type',
      message: 'Type must be BLOOD_DONATION or ORGAN_DONATION.',
    });
  }

  const title = asText(input.title);
  if (title.length < 5 || title.length > 120) {
    errors.push({ field: 'title', message: 'Title must be 5-120 characters.' });
  }

  const description = asText(input.description);
  if (description.length < 10 || description.length > 2000) {
    errors.push({
      field: 'description',
      message: 'Description must be 10-2000 characters.',
    });
  }

  const location = asText(input.location);
  if (location.length < 3 || location.length > 160) {
    errors.push({ field: 'location', message: 'Location must be 3-160 characters.' });
  }

  const startsAt = new Date(asText(input.startsAt));
  const earliest = Date.now() - 24 * 60 * 60 * 1000;
  const latest = Date.now() + 365 * 24 * 60 * 60 * 1000;
  if (
    !asText(input.startsAt) ||
    Number.isNaN(startsAt.getTime()) ||
    startsAt.getTime() < earliest ||
    startsAt.getTime() > latest
  ) {
    errors.push({
      field: 'startsAt',
      message: 'Choose a date from yesterday up to one year ahead.',
    });
  }

  const rawAudience = (asText(input.audience) || 'ALL').toUpperCase();
  const audience = (Object.values(CampaignAudience) as string[]).includes(rawAudience)
    ? (rawAudience as CampaignAudience)
    : null;
  if (!audience) {
    errors.push({ field: 'audience', message: 'Audience must be ALL, CITY or BLOOD_GROUP.' });
  }

  let audienceValue: string | null = null;
  if (audience === CampaignAudience.CITY) {
    audienceValue = asText(input.audienceValue);
    if (audienceValue.length < 2 || audienceValue.length > 80) {
      errors.push({ field: 'audienceValue', message: 'City must be 2-80 characters.' });
    }
  } else if (audience === CampaignAudience.BLOOD_GROUP) {
    const rawGroup = asText(input.audienceValue).toUpperCase();
    audienceValue = BLOOD_GROUPS.find((group) => group === rawGroup) ?? null;
    if (!audienceValue) {
      errors.push({
        field: 'audienceValue',
        message: `Blood group must be one of ${BLOOD_GROUPS.join(', ')}.`,
      });
    }
  }

  let channels: NotificationChannel[] = [...ALL_CHANNELS];
  if (input.channels !== undefined) {
    if (!Array.isArray(input.channels) || input.channels.length === 0) {
      errors.push({
        field: 'channels',
        message: 'Choose at least one delivery channel (EMAIL, SMS or PUSH).',
      });
    } else {
      channels = [];
      for (const entry of input.channels) {
        const raw = asText(entry).toUpperCase();
        const channel = (Object.values(NotificationChannel) as string[]).includes(raw)
          ? (raw as NotificationChannel)
          : null;
        if (!channel) {
          errors.push({
            field: 'channels',
            message: 'Channels must be EMAIL, SMS or PUSH.',
          });
          break;
        }
        if (!channels.includes(channel)) channels.push(channel);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: type as CampaignType,
      title,
      description,
      location,
      startsAt,
      audience: audience as CampaignAudience,
      audienceValue,
      channels,
    },
  };
}

export interface PatientProfileInput {
  email: string | null;
  city: string | null;
  bloodGroup: BloodGroup | null;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Partial update: only the keys present in the body are changed. */
export function validatePatientProfile(
  body: unknown,
): Result<Partial<PatientProfileInput>> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const value: Partial<PatientProfileInput> = {};

  if ('email' in input) {
    const email = asText(input.email);
    if (!email) {
      value.email = null;
    } else if (email.length > 160 || !EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'email', message: 'Enter a valid email address.' });
    } else {
      value.email = email;
    }
  }

  if ('city' in input) {
    const city = asText(input.city);
    if (!city) {
      value.city = null;
    } else if (city.length < 2 || city.length > 80) {
      errors.push({ field: 'city', message: 'City must be 2-80 characters.' });
    } else {
      value.city = city;
    }
  }

  if ('bloodGroup' in input) {
    const raw = asText(input.bloodGroup).toUpperCase();
    if (!raw) {
      value.bloodGroup = null;
    } else {
      const group = BLOOD_GROUPS.find((entry) => entry === raw) ?? null;
      if (!group) {
        errors.push({
          field: 'bloodGroup',
          message: `Blood group must be one of ${BLOOD_GROUPS.join(', ')}.`,
        });
      } else {
        value.bloodGroup = group;
      }
    }
  }

  for (const flag of ['notifyEmail', 'notifySms', 'notifyPush'] as const) {
    if (!(flag in input)) continue;
    if (typeof input[flag] !== 'boolean') {
      errors.push({ field: flag, message: `${flag} must be true or false.` });
    } else {
      value[flag] = input[flag] as boolean;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function validatePushSubscription(
  body: unknown,
): Result<PushSubscriptionInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const keys = (input.keys ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];

  const endpoint = asText(input.endpoint);
  if (!endpoint || endpoint.length > 1000) {
    errors.push({ field: 'endpoint', message: 'A push endpoint is required.' });
  } else {
    try {
      if (new URL(endpoint).protocol !== 'https:') throw new Error('not https');
    } catch {
      errors.push({ field: 'endpoint', message: 'The push endpoint must be an https URL.' });
    }
  }

  const p256dh = asText(input.p256dh ?? keys.p256dh);
  if (p256dh.length < 10 || p256dh.length > 300) {
    errors.push({ field: 'keys.p256dh', message: 'The push key is missing or invalid.' });
  }

  const auth = asText(input.auth ?? keys.auth);
  if (auth.length < 5 || auth.length > 300) {
    errors.push({ field: 'keys.auth', message: 'The push auth secret is missing or invalid.' });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { endpoint, p256dh, auth } };
}

export type PrebookingAction =
  | 'CONFIRM'
  | 'DECLINE'
  | 'ADMIT'
  | 'DISCHARGE'
  | 'APPROVE_CANCELLATION'
  | 'REJECT_CANCELLATION';

const DECISION_ACTIONS: Record<string, PrebookingAction> = {
  CONFIRM: 'CONFIRM',
  CONFIRMED: 'CONFIRM',
  DECLINE: 'DECLINE',
  DECLINED: 'DECLINE',
  ADMIT: 'ADMIT',
  DISCHARGE: 'DISCHARGE',
  APPROVE_CANCELLATION: 'APPROVE_CANCELLATION',
  APPROVE_CANCEL: 'APPROVE_CANCELLATION',
  REJECT_CANCELLATION: 'REJECT_CANCELLATION',
  REJECT_CANCEL: 'REJECT_CANCELLATION',
};

export function validatePrebookingDecision(
  body: unknown,
): Result<{ action: PrebookingAction }> {
  const input = (body ?? {}) as Record<string, unknown>;
  // `status: CONFIRMED | DECLINED` stays supported for the original flow.
  const raw = (asText(input.action) || asText(input.status)).toUpperCase();
  const action = DECISION_ACTIONS[raw];
  if (!action) {
    return {
      ok: false,
      errors: [
        {
          field: 'action',
          message:
            'Action must be CONFIRM, DECLINE, ADMIT, DISCHARGE, APPROVE_CANCELLATION or REJECT_CANCELLATION.',
        },
      ],
    };
  }
  return { ok: true, value: { action } };
}

export const PREBOOKING_STATUSES = Object.values(PrebookingStatus);
