import { describe, expect, it } from 'vitest';
import {
  priorityScore,
  rankRequests,
  WAITING_CAP_MINUTES,
  waitingMinutesSince,
  type RankableRequest,
} from '../src/services/priorityQueue';
import type { Severity } from '../src/types';

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const minutesAgo = (minutes: number): Date => new Date(NOW - minutes * 60_000);

function request(
  requestId: string,
  severity: Severity,
  waitingMinutes: number,
  status = 'QUEUED',
): RankableRequest {
  return { requestId, severity, status, createdAt: minutesAgo(waitingMinutes) };
}

describe('priority scoring', () => {
  it('uses weights 4/3/2/1 with the waiting minute added', () => {
    expect(priorityScore('CRITICAL', minutesAgo(0), NOW)).toBe(4000);
    expect(priorityScore('HIGH', minutesAgo(0), NOW)).toBe(3000);
    expect(priorityScore('MEDIUM', minutesAgo(0), NOW)).toBe(2000);
    expect(priorityScore('LOW', minutesAgo(0), NOW)).toBe(1000);
    expect(priorityScore('HIGH', minutesAgo(42), NOW)).toBe(3042);
  });

  it('caps waiting at 999 minutes', () => {
    expect(priorityScore('LOW', minutesAgo(5000), NOW)).toBe(1000 + WAITING_CAP_MINUTES);
  });

  it('never returns a negative wait for a clock-skewed created-at', () => {
    expect(waitingMinutesSince(new Date(NOW + 60_000), NOW)).toBe(0);
  });

  it('keeps a CRITICAL ahead of a HIGH that has waited far longer', () => {
    const ranked = rankRequests(
      [request('REQ-2026-0002', 'HIGH', 900), request('REQ-2026-0001', 'CRITICAL', 1)],
      NOW,
    );
    expect(ranked.map((entry) => entry.item.requestId)).toEqual([
      'REQ-2026-0001',
      'REQ-2026-0002',
    ]);
  });

  it('orders equal severity by longest wait', () => {
    const ranked = rankRequests(
      [
        request('REQ-2026-0001', 'HIGH', 5),
        request('REQ-2026-0002', 'HIGH', 40),
        request('REQ-2026-0003', 'HIGH', 20),
      ],
      NOW,
    );
    expect(ranked.map((entry) => entry.item.requestId)).toEqual([
      'REQ-2026-0002',
      'REQ-2026-0003',
      'REQ-2026-0001',
    ]);
  });

  it('breaks an exact tie deterministically by request ID', () => {
    const ranked = rankRequests(
      [request('REQ-2026-0009', 'MEDIUM', 10), request('REQ-2026-0004', 'MEDIUM', 10)],
      NOW,
    );
    expect(ranked[0]!.item.requestId).toBe('REQ-2026-0004');
  });

  it('excludes CLOSED requests and numbers the rest from 1', () => {
    const ranked = rankRequests(
      [
        request('REQ-2026-0001', 'LOW', 1),
        request('REQ-2026-0002', 'CRITICAL', 2, 'CLOSED'),
        request('REQ-2026-0003', 'MEDIUM', 3),
      ],
      NOW,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(ranked[0]!.severityWeight).toBe(2);
  });
});
