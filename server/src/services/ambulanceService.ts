import { randomInt } from 'node:crypto';
import { AmbulanceStatus, Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AVERAGE_SPEED_KMH, etaMinutes, haversineKm } from '../utils/geo';
import type { ValidatedAmbulanceSearch } from '../validation/ambulanceSearch';
import { areaLabel } from './dashboardService';

export interface AmbulanceCandidate {
  ambulanceId: string;
  regNo: string;
  status: AmbulanceStatus;
  location: { lat: number; lon: number; label: string };
  distanceKm: number;
  etaMinutes: number;
  isNearest: boolean;
}

export interface AmbulanceSearchPayload {
  generatedAt: string;
  origin: { lat: number; lon: number; label: string };
  request: {
    requestId: string;
    patientName: string;
    patientAge: number;
    severity: string;
    status: string;
    area: string;
    waitingMinutes: number;
    bloodGroupNeeded: string | null;
    medicineNeeded: string | null;
  } | null;
  search: {
    method: 'haversine';
    speedKmh: number;
    limit: number;
    eligible: number;
    totalFleet: number;
    excluded: { BUSY: number; OFFLINE: number };
  };
  ambulances: AmbulanceCandidate[];
}

export type AmbulanceSearchOutcome =
  | { ok: true; payload: AmbulanceSearchPayload }
  | { ok: false; reason: 'NOT_FOUND' | 'CLOSED' };

export class AmbulanceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AmbulanceError';
  }
}

export interface CreateAmbulanceInput {
  regNo: string;
  lat: number;
  lon: number;
  status?: AmbulanceStatus;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (length: number): string =>
  Array.from(
    { length },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join('');

/** Registers a vehicle in the fleet; no sample fleet is seeded. */
export async function createAmbulance(input: CreateAmbulanceInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ambulanceId = `AMB-${code(6)}`;
    try {
      const row = await prisma.ambulance.create({
        data: {
          ambulanceId,
          regNo: input.regNo,
          lat: input.lat,
          lon: input.lon,
          status: input.status ?? AmbulanceStatus.AVAILABLE,
        },
      });
      return {
        ambulanceId: row.ambulanceId,
        regNo: row.regNo,
        status: row.status,
        location: {
          lat: row.lat,
          lon: row.lon,
          label: areaLabel(row.lat, row.lon),
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target ?? '').includes('reg_no')
      ) {
        throw new AmbulanceError(
          'REG_NO_TAKEN',
          409,
          `Ambulance ${input.regNo} is already in the fleet.`,
        );
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
  }
  throw new AmbulanceError(
    'ID_GENERATION_FAILED',
    503,
    'Could not allocate an ambulance id. Please try again.',
  );
}

export async function listFleet() {
  const rows = await prisma.ambulance.findMany({ orderBy: { regNo: 'asc' } });
  return rows.map((row) => ({
    ambulanceId: row.ambulanceId,
    regNo: row.regNo,
    status: row.status,
    location: {
      lat: row.lat,
      lon: row.lon,
      label: areaLabel(row.lat, row.lon),
    },
  }));
}

const countFor = (
  groups: { status: AmbulanceStatus; _count: { _all: number } }[],
  status: AmbulanceStatus,
): number => groups.find((group) => group.status === status)?._count._all ?? 0;

/**
 * Ambulance search: straight-line Haversine distance from
 * the emergency to every AVAILABLE ambulance, nearest first, with an ETA.
 *
 * BUSY and OFFLINE vehicles are never candidates - the eligibility filter runs
 * in the database (`WHERE status = 'AVAILABLE'`), and the excluded counts are
 * returned so the dispatcher can see that the filter is real.
 */
export async function searchNearbyAmbulances(
  input: ValidatedAmbulanceSearch,
  now = Date.now(),
): Promise<AmbulanceSearchOutcome> {
  let origin = { lat: input.lat ?? 0, lon: input.lon ?? 0 };
  let request: AmbulanceSearchPayload['request'] = null;

  if (input.requestId) {
    const row = await prisma.emergencyRequest.findUnique({
      where: { requestId: input.requestId },
      include: { patient: true },
    });
    if (!row) return { ok: false, reason: 'NOT_FOUND' };
    if (row.status === RequestStatus.CLOSED) return { ok: false, reason: 'CLOSED' };

    origin = { lat: row.lat, lon: row.lon };
    request = {
      requestId: row.requestId,
      patientName: row.patient.name,
      patientAge: row.patient.age,
      severity: row.severity,
      status: row.status,
      area: areaLabel(row.lat, row.lon),
      waitingMinutes: Math.max(
        0,
        Math.floor((now - row.createdAt.getTime()) / 60_000),
      ),
      bloodGroupNeeded: row.bloodGroupNeeded,
      medicineNeeded: row.medicineNeeded,
    };
  }

  const [available, statusGroups] = await Promise.all([
    prisma.ambulance.findMany({
      where: { status: AmbulanceStatus.AVAILABLE },
      orderBy: { regNo: 'asc' },
    }),
    prisma.ambulance.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const candidates: AmbulanceCandidate[] = available
    .map((row) => {
      const distanceKm = haversineKm(origin, { lat: row.lat, lon: row.lon });
      return {
        ambulanceId: row.ambulanceId,
        regNo: row.regNo,
        status: row.status,
        location: {
          lat: row.lat,
          lon: row.lon,
          label: areaLabel(row.lat, row.lon),
        },
        distanceKm,
        etaMinutes: etaMinutes(distanceKm),
        isNearest: false,
      };
    })
    // Equal distances fall back to the registration number, so the order is
    // deterministic across repeated searches.
    .sort(
      (a, b) => a.distanceKm - b.distanceKm || a.regNo.localeCompare(b.regNo),
    )
    .slice(0, input.limit)
    .map((candidate, index) => ({ ...candidate, isNearest: index === 0 }));

  const busy = countFor(statusGroups, AmbulanceStatus.BUSY);
  const offline = countFor(statusGroups, AmbulanceStatus.OFFLINE);

  return {
    ok: true,
    payload: {
      generatedAt: new Date(now).toISOString(),
      origin: { ...origin, label: areaLabel(origin.lat, origin.lon) },
      request,
      search: {
        method: 'haversine',
        speedKmh: AVERAGE_SPEED_KMH,
        limit: input.limit,
        eligible: available.length,
        totalFleet: available.length + busy + offline,
        excluded: { BUSY: busy, OFFLINE: offline },
      },
      ambulances: candidates,
    },
  };
}
