import { SEVERITY_WEIGHT, type Severity } from '../types';

/**
 * Severity ranking, implemented once and shared by every screen.
 *
 * Rule: severity first, waiting time as the tie-break.
 *   priorityScore = severityWeight * 1000 + min(waitingMinutes, 999)
 *
 * The 1,000 multiplier is larger than the waiting cap, so a CRITICAL (4000+)
 * always outranks a HIGH (3000+), no matter how long the HIGH has waited. The
 * waiting component then orders calls of equal severity: the longest wait is
 * served first. Capping at 999 is what makes that guarantee provable - waiting
 * can never overflow into the next severity band.
 *
 * Equal score and equal created-at (two calls in the same minute) fall back to
 * the older created-at and then the request ID, so ordering is deterministic.
 */
export const WAITING_CAP_MINUTES = 999;
export const SEVERITY_DOMINANCE_FACTOR = 1000;
export const MINUTES_PER_MS = 60_000;

export interface RankableRequest {
  requestId: string;
  severity: Severity;
  status: string;
  createdAt: Date;
}

export interface RankedRequest<T extends RankableRequest> {
  item: T;
  rank: number;
  severityWeight: number;
  waitingMinutes: number;
  priorityScore: number;
}

export const RANKING_ALGORITHM = {
  name: 'severity-weight-then-wait',
  formula: `priorityScore = severityWeight × ${SEVERITY_DOMINANCE_FACTOR} + min(waitingMinutes, ${WAITING_CAP_MINUTES})`,
  rule: 'A higher severity weight always wins. Within the same severity the longest wait goes first; remaining ties fall back to the older created-at, then the request ID.',
  weights: SEVERITY_WEIGHT,
  waitingCapMinutes: WAITING_CAP_MINUTES,
  dominanceFactor: SEVERITY_DOMINANCE_FACTOR,
  complexity: 'O(n log n) sort over the open queue, recomputed per API request',
} as const;

/** Whole minutes a request has been waiting, never negative. */
export function waitingMinutesSince(createdAt: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - createdAt.getTime()) / MINUTES_PER_MS));
}

/** Score a single request. Higher score = served earlier. */
export function priorityScore(
  severity: Severity,
  createdAt: Date,
  now = Date.now(),
): number {
  const weight = SEVERITY_WEIGHT[severity];
  const waiting = Math.min(waitingMinutesSince(createdAt, now), WAITING_CAP_MINUTES);
  return weight * SEVERITY_DOMINANCE_FACTOR + waiting;
}

/**
 * Rank open requests. CLOSED cases are excluded - closing a case removes it
 * from the queue, so every poll after a closure sees a freshly ranked list.
 */
export function rankRequests<T extends RankableRequest>(
  requests: T[],
  now = Date.now(),
): RankedRequest<T>[] {
  return requests
    .filter((request) => request.status !== 'CLOSED')
    .map((request) => {
      const severityWeight = SEVERITY_WEIGHT[request.severity];
      return {
        item: request,
        rank: 0,
        severityWeight,
        waitingMinutes: waitingMinutesSince(request.createdAt, now),
        priorityScore: priorityScore(request.severity, request.createdAt, now),
      };
    })
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        a.item.createdAt.getTime() - b.item.createdAt.getTime() ||
        a.item.requestId.localeCompare(b.item.requestId),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
