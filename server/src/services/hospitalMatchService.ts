import { RequestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { haversineKm } from '../utils/geo';
import { areaLabel } from './dashboardService';
import {
  NEARNESS_RADIUS_KM,
  READINESS_RULE,
  READINESS_WEIGHTS,
  rankHospitals,
  scoreHospital,
  type HospitalReadiness,
} from './readinessService';

export interface HospitalMatchPayload {
  role: 'DISPATCHER';
  generatedAt: string;
  algorithm: {
    blood: number;
    medicine: number;
    nearness: number;
    nearnessFormula: string;
    radiusKm: number;
    rule: string;
  };
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
    location: { lat: number; lon: number; label: string };
  };
  stats: {
    eligible: number;
    excluded: number;
    bestScore: number | null;
  };
  hospitals: HospitalReadiness[];
  excludedHospitals: {
    hospitalId: string;
    name: string;
    area: string;
    distanceKm: number;
    freeBeds: number;
    reason: string;
  }[];
}

export type HospitalMatchOutcome =
  | { ok: true; payload: HospitalMatchPayload }
  | { ok: false; reason: 'NOT_FOUND' | 'CLOSED' };

/**
 * Hospital matching: every hospital with a free bed is scored for this
 * emergency, then ranked. Hospitals without a free bed are returned separately
 * with the reason, so the exclusion is visible rather than silent.
 */
export async function matchHospitals(
  requestId: string,
  now = Date.now(),
): Promise<HospitalMatchOutcome> {
  const request = await prisma.emergencyRequest.findUnique({
    where: { requestId },
    include: { patient: true },
  });
  if (!request) return { ok: false, reason: 'NOT_FOUND' };
  if (request.status === RequestStatus.CLOSED) return { ok: false, reason: 'CLOSED' };

  const hospitals = await prisma.hospital.findMany({
    include: { bloodStock: true, medicineStock: true },
    orderBy: { name: 'asc' },
  });

  const scoringRequest = {
    requestId: request.requestId,
    lat: request.lat,
    lon: request.lon,
    bloodGroupNeeded: request.bloodGroupNeeded,
    medicineNeeded: request.medicineNeeded,
  };

  const ranked = rankHospitals(
    hospitals
      .filter((hospital) => hospital.freeBeds > 0)
      .map((hospital) => scoreHospital(hospital, scoringRequest)),
  );

  const excludedHospitals = hospitals
    .filter((hospital) => hospital.freeBeds <= 0)
    .map((hospital) => {
      const distanceKm = haversineKm(
        { lat: request.lat, lon: request.lon },
        { lat: hospital.lat, lon: hospital.lon },
      );
      return {
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        area: areaLabel(hospital.lat, hospital.lon),
        distanceKm,
        freeBeds: hospital.freeBeds,
        reason: 'No free bed - excluded before scoring',
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    ok: true,
    payload: {
      role: 'DISPATCHER',
      generatedAt: new Date(now).toISOString(),
      algorithm: {
        blood: READINESS_WEIGHTS.blood,
        medicine: READINESS_WEIGHTS.medicine,
        nearness: READINESS_WEIGHTS.nearness,
        nearnessFormula: `nearness = ${READINESS_WEIGHTS.nearness} × max(0, 1 − d / ${NEARNESS_RADIUS_KM})`,
        radiusKm: NEARNESS_RADIUS_KM,
        rule: READINESS_RULE,
      },
      request: {
        requestId: request.requestId,
        patientName: request.patient.name,
        patientAge: request.patient.age,
        severity: request.severity,
        status: request.status,
        area: areaLabel(request.lat, request.lon),
        waitingMinutes: Math.max(
          0,
          Math.floor((now - request.createdAt.getTime()) / 60_000),
        ),
        bloodGroupNeeded: request.bloodGroupNeeded,
        medicineNeeded: request.medicineNeeded,
        location: {
          lat: request.lat,
          lon: request.lon,
          label: areaLabel(request.lat, request.lon),
        },
      },
      stats: {
        eligible: ranked.length,
        excluded: excludedHospitals.length,
        bestScore: ranked[0]?.score ?? null,
      },
      hospitals: ranked,
      excludedHospitals,
    },
  };
}
