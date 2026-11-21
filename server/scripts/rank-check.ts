import { rankRequests, priorityScore } from '../src/services/priorityQueue';
import type { Severity } from '../src/types';

const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

type Row = {
  requestId: string;
  severity: Severity;
  status: string;
  createdAt: Date;
};

const row = (requestId: string, severity: Severity, minutes: number, status = 'QUEUED'): Row => ({
  requestId,
  severity,
  status,
  createdAt: minutesAgo(minutes),
});

const ranked = rankRequests(
  [
    row('LOW-OLD-600', 'LOW', 600),
    row('CRIT-NEW', 'CRITICAL', 0),
    row('HIGH-30-A', 'HIGH', 30),
    row('HIGH-30-B', 'HIGH', 30),
    row('HIGH-5', 'HIGH', 5),
    row('LOW-2000', 'LOW', 2000),
    row('CLOSED-CRIT', 'CRITICAL', 900, 'CLOSED'),
  ],
  now,
);

const order = ranked.map((entry) => entry.item.requestId);
const expected = ['CRIT-NEW', 'HIGH-30-A', 'HIGH-30-B', 'HIGH-5', 'LOW-2000', 'LOW-OLD-600'];

const checks: [string, boolean][] = [
  ['severity beats waiting (LOW 600 min stays behind new CRITICAL)', order[0] === 'CRIT-NEW'],
  ['equal severity: 30 min wait precedes 5 min wait', order.indexOf('HIGH-30-A') < order.indexOf('HIGH-5')],
  ['same-minute tie falls back to older created-at', order.indexOf('HIGH-30-A') < order.indexOf('HIGH-30-B')],
  ['waiting cap prevents a LOW overtaking a HIGH', priorityScore('LOW', minutesAgo(2000), now) < priorityScore('HIGH', minutesAgo(5), now)],
  ['capped waiting still orders longest-first inside a severity', priorityScore('LOW', minutesAgo(2000), now) > priorityScore('LOW', minutesAgo(600), now)],
  ['closed cases are excluded', !order.includes('CLOSED-CRIT')],
  ['order is deterministic', JSON.stringify(order) === JSON.stringify(expected)],
  ['score formula holds', ranked[0]?.priorityScore === 4000],
  ['ranks are 1..n', ranked.every((entry, index) => entry.rank === index + 1)],
];

console.table(
  ranked.map((entry) => ({
    rank: entry.rank,
    request: entry.item.requestId,
    weight: entry.severityWeight,
    wait: entry.waitingMinutes,
    score: entry.priorityScore,
  })),
);

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
  if (!passed) failed += 1;
}
console.log(`\nexpected order: ${expected.join(' > ')}`);
console.log(`actual order:   ${order.join(' > ')}`);
if (failed > 0) {
  console.error(`\n${failed} algorithm check(s) failed`);
  process.exit(1);
}
console.log('\nall ranking checks passed');
