import { Ambulance as AmbulanceIcon, MapPin } from 'lucide-react';
import type { AmbulanceSummary } from '../../lib/types';
import { AmbulanceStatusChip } from '../ui/Badges';

export function FleetPanel({ ambulances }: { ambulances: AmbulanceSummary[] }) {
  return (
    <ul className="max-h-[352px] divide-y divide-ink-200/60 overflow-y-auto scroll-slim">
      {ambulances.map((ambulance) => (
        <li
          key={ambulance.ambulanceId}
          className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-100/40"
        >
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              ambulance.status === 'AVAILABLE'
                ? 'bg-emerald-50 text-stable'
                : ambulance.status === 'BUSY'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-ink-100 text-ink-400'
            }`}
          >
            <AmbulanceIcon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-ink-900">
              {ambulance.regNo}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-500">
              <MapPin size={10} className="shrink-0 text-ink-400" />
              {ambulance.location.label}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <AmbulanceStatusChip status={ambulance.status} />
            <p className="mt-1 text-[10.5px] tabular-nums text-ink-400">
              {ambulance.distanceKmToLatestRequest !== null
                ? `${ambulance.distanceKmToLatestRequest} km to latest call`
                : 'no active call'}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
