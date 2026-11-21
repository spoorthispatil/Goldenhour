import { describe, expect, it } from 'vitest';
import {
  nearnessPoints,
  rankHospitals,
  scoreHospital,
  type ScoringHospital,
} from '../src/services/readinessService';

const BASE_HOSPITAL: ScoringHospital = {
  hospitalId: 'HOSP-T1',
  name: 'Test Hospital',
  lat: 15.3647,
  lon: 75.124,
  totalBeds: 100,
  freeBeds: 4,
  bloodStock: [
    { bloodGroup: 'O+', units: 6 },
    { bloodGroup: 'B-', units: 0 },
  ],
  medicineStock: [
    { medicine: 'Adrenaline', units: 10 },
    { medicine: 'Tetanus Toxoid', units: 0 },
  ],
};

const hospital = (overrides: Partial<ScoringHospital> = {}): ScoringHospital => ({
  ...BASE_HOSPITAL,
  ...overrides,
});

const request = (overrides: Partial<{ bloodGroupNeeded: string | null; medicineNeeded: string | null }> = {}) => ({
  requestId: 'REQ-2026-0001',
  lat: 15.3647,
  lon: 75.124,
  bloodGroupNeeded: null as string | null,
  medicineNeeded: null as string | null,
  ...overrides,
});

describe('nearness curve', () => {
  it('follows 20 x max(0, 1 - d/25) at the documented points', () => {
    expect(nearnessPoints(0)).toBe(20);
    expect(nearnessPoints(5)).toBe(16);
    expect(nearnessPoints(12.5)).toBe(10);
    expect(nearnessPoints(20)).toBe(4);
    expect(nearnessPoints(25)).toBe(0);
    expect(nearnessPoints(80)).toBe(0);
  });
});

describe('hospital readiness', () => {
  it('scores 100 at the same coordinates when nothing is required', () => {
    const result = scoreHospital(hospital(), request());
    expect(result.score).toBe(100);
    expect(result.partialFlag).toBe(false);
    expect(result.components.blood.points).toBe(40);
    expect(result.components.medicine.points).toBe(40);
    expect(result.components.nearness.points).toBe(20);
  });

  it('awards 40 for a stocked blood group and 0 with a partial flag when empty', () => {
    const stocked = scoreHospital(hospital(), request({ bloodGroupNeeded: 'O+' }));
    expect(stocked.components.blood.points).toBe(40);
    expect(stocked.partialFlag).toBe(false);

    const empty = scoreHospital(hospital(), request({ bloodGroupNeeded: 'B-' }));
    expect(empty.components.blood.points).toBe(0);
    expect(empty.score).toBe(60);
    expect(empty.partialFlag).toBe(true);
    expect(empty.reason).toContain('B- not in stock');
  });

  it('matches medicine names case-insensitively', () => {
    const result = scoreHospital(hospital(), request({ medicineNeeded: 'adrenaline' }));
    expect(result.components.medicine.points).toBe(40);
    expect(result.components.medicine.medicine).toBe('adrenaline');
    expect(result.partialFlag).toBe(false);
  });

  it('flags a required medicine with zero units', () => {
    const result = scoreHospital(
      hospital(),
      request({ medicineNeeded: 'Tetanus Toxoid' }),
    );
    expect(result.components.medicine.points).toBe(0);
    expect(result.partialFlag).toBe(true);
  });

  it('sums the components into the reported score', () => {
    const result = scoreHospital(
      hospital({ lat: 15.4167, lon: 75.124 }),
      request({ bloodGroupNeeded: 'O+', medicineNeeded: 'Adrenaline' }),
    );
    const { blood, medicine, nearness } = result.components;
    expect(result.score).toBe(
      Math.round((blood.points + medicine.points + nearness.points) * 100) / 100,
    );
    expect(result.distanceKm).toBeGreaterThan(5);
    expect(result.distanceKm).toBeLessThan(7);
  });

  it('orders by score, then distance, then name', () => {
    const ranked = rankHospitals([
      { ...scoreHospital(hospital(), request()), hospitalId: 'B', name: 'Bravo' },
      { ...scoreHospital(hospital(), request()), hospitalId: 'A', name: 'Alpha' },
      {
        ...scoreHospital(hospital({ lat: 15.4 }), request()),
        hospitalId: 'C',
        name: 'Charlie',
      },
    ]);
    expect(ranked.map((entry) => entry.hospitalId)).toEqual(['A', 'B', 'C']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });
});
