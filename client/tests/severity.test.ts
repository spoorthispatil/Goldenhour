import { describe, expect, it } from 'vitest';
import { formatWaiting, SEVERITY_ORDER, SEVERITY_WEIGHT } from '../src/lib/severity';

describe('severity constants', () => {
  it('uses the severity weights and order', () => {
    expect(SEVERITY_ORDER).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
    expect(SEVERITY_ORDER.map((severity) => SEVERITY_WEIGHT[severity])).toEqual([4, 3, 2, 1]);
  });
});

describe('formatWaiting', () => {
  it('handles just-now, minutes and hours', () => {
    expect(formatWaiting(0)).toBe('just now');
    expect(formatWaiting(1)).toBe('1 min');
    expect(formatWaiting(59)).toBe('59 min');
    expect(formatWaiting(60)).toBe('1 h');
    expect(formatWaiting(135)).toBe('2 h 15 min');
  });
});
