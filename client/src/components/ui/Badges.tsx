import type { AmbulanceStatus, RequestStatus, Severity } from '../../lib/types';
import { SEVERITY_STYLE } from '../../lib/severity';
import { useRealtimeStatus } from '../../lib/realtime';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity];
  return (
    <span className={`chip ${style.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

const STATUS_STYLE: Record<RequestStatus, string> = {
  QUEUED: 'border-slate-200 bg-slate-50 text-slate-600',
  ASSIGNED: 'border-blue-200 bg-blue-50 text-blue-700',
  CLOSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function RequestStatusChip({ status }: { status: RequestStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{status}</span>;
}

const AMBULANCE_STYLE: Record<AmbulanceStatus, string> = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  BUSY: 'border-amber-200 bg-amber-50 text-amber-700',
  OFFLINE: 'border-slate-200 bg-slate-100 text-slate-500',
};

export function AmbulanceStatusChip({ status }: { status: AmbulanceStatus }) {
  return (
    <span className={`chip ${AMBULANCE_STYLE[status]}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'AVAILABLE'
            ? 'bg-emerald-600'
            : status === 'BUSY'
              ? 'bg-amber-500'
              : 'bg-slate-400'
        }`}
      />
      {status}
    </span>
  );
}

export function LiveBadge({ polling }: { polling: boolean }) {
  const socketOnline = useRealtimeStatus();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-700">
      <span className="relative flex h-2 w-2">
        {polling ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        ) : null}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
      </span>
      {socketOnline ? 'Live - instant updates' : 'Live - polling fallback'}
    </span>
  );
}
