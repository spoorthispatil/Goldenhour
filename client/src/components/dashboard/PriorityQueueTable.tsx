import { MapPin, Timer } from 'lucide-react';
import type { PriorityQueueItem } from '../../lib/types';
import { formatWaiting, SEVERITY_STYLE } from '../../lib/severity';
import { RequestStatusChip, SeverityBadge } from '../ui/Badges';
import { EmptyState } from '../ui/Card';

/**
 * Ranked queue table. The score bar is relative to the highest score in the
 * list, so the severity dominance is visible at a glance.
 */
export function PriorityQueueTable({ items }: { items: PriorityQueueItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Queue is empty"
        description="Every emergency has an ambulance. Register a new call and it will be ranked here immediately."
      />
    );
  }

  const maxScore = Math.max(...items.map((item) => item.priorityScore));

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-5 py-2.5 font-semibold">Rank</th>
            <th className="px-3 py-2.5 font-semibold">Request</th>
            <th className="px-3 py-2.5 font-semibold">Patient</th>
            <th className="px-3 py-2.5 font-semibold">Severity</th>
            <th className="px-3 py-2.5 font-semibold">Waiting</th>
            <th className="px-3 py-2.5 font-semibold">Priority score</th>
            <th className="px-3 py-2.5 font-semibold">Location</th>
            <th className="px-5 py-2.5 font-semibold">Needs</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const style = SEVERITY_STYLE[item.severity];
            const width = Math.max(6, Math.round((item.priorityScore / maxScore) * 100));
            return (
              <tr
                key={item.requestId}
                className="border-t border-ink-200/60 transition hover:bg-ink-100/40"
              >
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`h-7 w-1 rounded-full ${style.dot}`}
                      aria-hidden="true"
                    />
                    <span className="text-[14px] font-bold tabular-nums text-ink-800">
                      {item.rank}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <p className="text-[12.5px] font-semibold text-ink-900">
                    {item.requestId}
                  </p>
                  <RequestStatusChip status={item.status} />
                </td>
                <td className="px-3 py-3">
                  <p className="text-[12.5px] font-medium text-ink-800">
                    {item.patientName}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    {item.patientAge} yrs - {item.patientContact}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <SeverityBadge severity={item.severity} />
                  <p className="mt-1 font-mono text-[10.5px] text-ink-400">
                    weight {item.severityWeight}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums text-ink-700">
                    <Timer size={12} className="text-ink-400" />
                    {formatWaiting(item.waitingMinutes)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <p className="font-mono text-[12px] font-semibold tabular-nums text-ink-900">
                    {item.priorityScore}
                  </p>
                  <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={`h-full rounded-full ${style.dot}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex max-w-[170px] items-center gap-1.5 text-[12px] text-ink-600">
                    <MapPin size={12} className="shrink-0 text-ink-400" />
                    <span className="truncate">{item.location.label}</span>
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.bloodGroupNeeded ? (
                      <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700">
                        {item.bloodGroupNeeded}
                      </span>
                    ) : null}
                    {item.medicineNeeded ? (
                      <span className="max-w-[110px] truncate rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">
                        {item.medicineNeeded}
                      </span>
                    ) : null}
                    {!item.bloodGroupNeeded && !item.medicineNeeded ? (
                      <span className="text-[11px] text-ink-400">None</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
