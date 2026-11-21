import { MapPin, Timer } from 'lucide-react';
import type { QueueItem } from '../../lib/types';
import { formatWaiting, SEVERITY_STYLE } from '../../lib/severity';
import { RequestStatusChip, SeverityBadge } from '../ui/Badges';
import { EmptyState } from '../ui/Card';

export function QueueTable({ items, limit }: { items: QueueItem[]; limit?: number }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No open emergencies"
        description="When a dispatcher registers a call, it appears here in severity order."
      />
    );
  }

  const rows = limit ? items.slice(0, limit) : items;

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-5 py-2.5 font-semibold">Rank</th>
            <th className="px-3 py-2.5 font-semibold">Request</th>
            <th className="px-3 py-2.5 font-semibold">Patient</th>
            <th className="px-3 py-2.5 font-semibold">Severity</th>
            <th className="px-3 py-2.5 font-semibold">Waiting</th>
            <th className="px-3 py-2.5 font-semibold">Location</th>
            <th className="px-3 py-2.5 font-semibold">Needs</th>
            <th className="px-5 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const style = SEVERITY_STYLE[item.severity];
            return (
              <tr
                key={item.requestId}
                className="border-t border-ink-200/60 transition hover:bg-ink-100/40"
              >
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`h-6 w-1 rounded-full ${style.dot}`}
                      aria-hidden="true"
                    />
                    <span className="text-[12px] font-bold tabular-nums text-ink-700">
                      {item.rank}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 text-[12.5px] font-semibold text-ink-900">
                  {item.requestId}
                </td>
                <td className="px-3 py-3">
                  <p className="text-[12.5px] font-medium text-ink-800">
                    {item.patientName}
                  </p>
                  <p className="text-[11px] text-ink-400">{item.patientAge} yrs</p>
                </td>
                <td className="px-3 py-3">
                  <SeverityBadge severity={item.severity} />
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums text-ink-700">
                    <Timer size={12} className="text-ink-400" />
                    {formatWaiting(item.waitingMinutes)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex max-w-[190px] items-center gap-1.5 text-[12px] text-ink-600">
                    <MapPin size={12} className="shrink-0 text-ink-400" />
                    <span className="truncate">{item.location.label}</span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.bloodGroupNeeded ? (
                      <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700">
                        {item.bloodGroupNeeded}
                      </span>
                    ) : null}
                    {item.medicineNeeded ? (
                      <span className="max-w-[120px] truncate rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">
                        {item.medicineNeeded}
                      </span>
                    ) : null}
                    {!item.bloodGroupNeeded && !item.medicineNeeded ? (
                      <span className="text-[11px] text-ink-400">None</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <RequestStatusChip status={item.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {limit && items.length > limit ? (
        <p className="border-t border-ink-200/60 px-5 py-2.5 text-[11.5px] text-ink-400">
          Showing the first {limit} of {items.length} queued requests.
        </p>
      ) : null}
    </div>
  );
}
