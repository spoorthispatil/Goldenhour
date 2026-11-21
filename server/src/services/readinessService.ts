import { areaLabel } from '../utils/areas';
import { haversineKm } from '../utils/geo';

/**
 * Hospital readiness score, out of 100:
 *   blood 40 + medicine 40 + nearness 20
 *
 * A component that the emergency does not require is awarded in full, because
 * the hospital cannot fail a requirement that does not exist. A required blood
 * group or medicine scores either full points (in stock) or zero - stock is
 * checked in whole units, not proportionally.
 *
 * Nearness uses the normalisation approved before implementation:
 *   nearness = 20 × max(0, 1 − d / 25), d = Haversine km, 2 decimals
 * so 0 km → 20, 5 km → 16, 12.5 km → 10, 20 km → 4 and 25 km or more → 0.
 *
 * Facility eligibility is separate: only a hospital with at least one free bed
 * is scored at all.
 */
export const READINESS_WEIGHTS = {
  blood: 40,
  medicine: 40,
  nearness: 20,
} as const;

export const NEARNESS_RADIUS_KM = 25;

export const READINESS_RULE =
  'A hospital with no free bed is never scored. Blood and medicine award 40 points each when the requirement is met (or not required), and nearness awards up to 20 points on a 25 km linear decay.';

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function nearnessPoints(distanceKm: number): number {
  const remaining = Math.max(0, 1 - distanceKm / NEARNESS_RADIUS_KM);
  return round2(remaining * READINESS_WEIGHTS.nearness);
}

export interface ScoringStock {
  bloodGroup: string;
  units: number;
}

export interface ScoringMedicine {
  medicine: string;
  units: number;
}

export interface ScoringHospital {
  hospitalId: string;
  name: string;
  lat: number;
  lon: number;
  totalBeds: number;
  freeBeds: number;
  bloodStock: ScoringStock[];
  medicineStock: ScoringMedicine[];
}

export interface ScoringRequest {
  requestId: string;
  lat: number;
  lon: number;
  bloodGroupNeeded: string | null;
  medicineNeeded: string | null;
}

export interface HospitalReadiness {
  rank: number;
  hospitalId: string;
  name: string;
  area: string;
  distanceKm: number;
  totalBeds: number;
  freeBeds: number;
  score: number;
  partialFlag: boolean;
  reason: string;
  components: {
    blood: {
      required: boolean;
      group: string | null;
      units: number | null;
      points: number;
      max: number;
    };
    medicine: {
      required: boolean;
      medicine: string | null;
      units: number | null;
      points: number;
      max: number;
    };
    nearness: {
      distanceKm: number;
      radiusKm: number;
      points: number;
      max: number;
    };
  };
}

const displayScore = (score: number): string =>
  Number.isInteger(score) ? String(score) : score.toFixed(1);

export function scoreHospital(
  hospital: ScoringHospital,
  request: ScoringRequest,
): HospitalReadiness {
  const distanceKm = haversineKm(
    { lat: request.lat, lon: request.lon },
    { lat: hospital.lat, lon: hospital.lon },
  );

  const bloodGroup = request.bloodGroupNeeded?.trim() || null;
  const bloodRequired = bloodGroup !== null;
  const bloodRow = bloodGroup
    ? hospital.bloodStock.find((stock) => stock.bloodGroup === bloodGroup)
    : undefined;
  const bloodUnits = bloodRequired ? (bloodRow?.units ?? 0) : null;
  const bloodPoints = bloodRequired
    ? (bloodUnits ?? 0) > 0
      ? READINESS_WEIGHTS.blood
      : 0
    : READINESS_WEIGHTS.blood;

  const medicineName = request.medicineNeeded?.trim() || null;
  const medicineRequired = medicineName !== null;
  const medicineRow = medicineName
    ? hospital.medicineStock.find(
        (stock) =>
          stock.medicine.trim().toLowerCase() === medicineName.toLowerCase(),
      )
    : undefined;
  const medicineUnits = medicineRequired ? (medicineRow?.units ?? 0) : null;
  const medicinePoints = medicineRequired
    ? (medicineUnits ?? 0) > 0
      ? READINESS_WEIGHTS.medicine
      : 0
    : READINESS_WEIGHTS.medicine;

  const nearness = nearnessPoints(distanceKm);
  const score = round2(bloodPoints + medicinePoints + nearness);
  const partialFlag =
    (bloodRequired && (bloodUnits ?? 0) <= 0) ||
    (medicineRequired && (medicineUnits ?? 0) <= 0);

  const bloodText = !bloodRequired
    ? 'blood group not required'
    : (bloodUnits ?? 0) > 0
      ? `${bloodGroup} in stock (${bloodUnits} units)`
      : `${bloodGroup} not in stock`;
  const medicineText = !medicineRequired
    ? 'medicine not required'
    : (medicineUnits ?? 0) > 0
      ? `${medicineName} in stock (${medicineUnits} units)`
      : `${medicineName} not stocked`;

  const reason = `${bloodText}; ${medicineText}; ${distanceKm.toFixed(2)} km away - ${displayScore(score)}/100${partialFlag ? ' (partial readiness)' : ''}`;

  return {
    rank: 0,
    hospitalId: hospital.hospitalId,
    name: hospital.name,
    area: areaLabel(hospital.lat, hospital.lon),
    distanceKm,
    totalBeds: hospital.totalBeds,
    freeBeds: hospital.freeBeds,
    score,
    partialFlag,
    reason,
    components: {
      blood: {
        required: bloodRequired,
        group: bloodGroup,
        units: bloodUnits,
        points: bloodPoints,
        max: READINESS_WEIGHTS.blood,
      },
      medicine: {
        required: medicineRequired,
        medicine: medicineName,
        units: medicineUnits,
        points: medicinePoints,
        max: READINESS_WEIGHTS.medicine,
      },
      nearness: {
        distanceKm,
        radiusKm: NEARNESS_RADIUS_KM,
        points: nearness,
        max: READINESS_WEIGHTS.nearness,
      },
    },
  };
}

/**
 * Highest score first. Equal scores fall back to the nearer hospital, then the
 * name, so the published order is deterministic.
 */
export function rankHospitals(hospitals: HospitalReadiness[]): HospitalReadiness[] {
  return [...hospitals]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distanceKm - b.distanceKm ||
        a.name.localeCompare(b.name),
    )
    .map((hospital, index) => ({ ...hospital, rank: index + 1 }));
}
