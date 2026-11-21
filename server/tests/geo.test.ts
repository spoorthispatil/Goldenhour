import { describe, expect, it } from 'vitest';
import { etaMinutes, haversineKm, MIN_ETA_MINUTES } from '../src/utils/geo';

describe('haversine distance', () => {
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 15.3647, lon: 75.124 }, { lat: 15.3647, lon: 75.124 })).toBe(0);
  });

  it('is symmetric and rounded to two decimals', () => {
    const a = { lat: 15.3647, lon: 75.124 };
    const b = { lat: 15.3663, lon: 75.1238 };
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
    expect(haversineKm(a, b)).toBeCloseTo(0.18, 2);
  });

  it('matches a known long-distance pair within tolerance', () => {
    // Delhi to Mumbai is roughly 1,150 km great-circle.
    const distance = haversineKm(
      { lat: 28.6139, lon: 77.209 },
      { lat: 19.076, lon: 72.8777 },
    );
    expect(distance).toBeGreaterThan(1130);
    expect(distance).toBeLessThan(1170);
  });
});

describe('ETA', () => {
  it('never returns less than the minimum turnaround', () => {
    expect(etaMinutes(0)).toBe(MIN_ETA_MINUTES);
    expect(etaMinutes(0.1)).toBe(MIN_ETA_MINUTES);
  });

  it('uses the documented 35 km/h average', () => {
    expect(etaMinutes(35)).toBe(60);
    expect(etaMinutes(3.5)).toBe(6);
  });
});
