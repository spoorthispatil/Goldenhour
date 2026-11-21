import { ArrowRight, MapPin, ShieldAlert } from 'lucide-react';
import type { AssignmentSummary } from '../../lib/types';
import { SEVERITY_STYLE } from '../../lib/severity';
import { ProgressBar } from '../ui/Card';

export function AssignmentList({ assignments }: { assignments: AssignmentSummary[] }) {
  return (
    <ul className="divide-y divide-ink-200/60">
      {assignments.map((assignment) => {
        const style = SEVERITY_STYLE[assignment.severity];
        return (
          <li key={assignment.assignmentId} className="px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-ink-900">
                  {assignment.requestId}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${style.chip}`}
                  >
                    {style.label}
                  </span>
                  {assignment.partialFlag ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      <ShieldAlert size={10} /> partial
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-ink-500">
                  {assignment.patientName}
                  <ArrowRight size={11} className="mx-1 inline" />
                  {assignment.hospitalName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[15px] font-bold leading-none text-ink-900">
                  {assignment.readinessScore}
                  <span className="text-[10px] font-medium text-ink-400">/100</span>
                </p>
                <p className="mt-1 text-[10.5px] text-ink-400">readiness</p>
              </div>
            </div>
            <ProgressBar
              value={assignment.readinessScore}
              tone={assignment.partialFlag ? 'warning' : 'brand'}
              className="mt-2"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {assignment.ambulanceRegNo}
              </span>
              <span className="tabular-nums">{assignment.distanceKm} km</span>
              <span className="truncate text-ink-400">{assignment.reason}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
