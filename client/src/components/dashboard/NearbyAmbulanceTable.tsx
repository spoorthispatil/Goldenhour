import { Ambulance as AmbulanceIcon, MapPin, Navigation, Timer } from 'lucide-react';
import type { AmbulanceSearchData } from '../../lib/types';
import { AmbulanceStatusChip } from '../ui/Badges';
import { EmptyState } from '../ui/Card';

export function NearbyAmbulanceTable({ data }: { data: AmbulanceSearchData }) {
  if (data.ambulances.length === 0) {
    return (
      <EmptyState
        title="No ambulance available"
        description={`All ${data.search.totalFleet} vehicles are busy or offline. Register the call and dispatch once a vehicle is released.`}
      />
    );
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-5 py-2.5 font-semibold">Rank</th>
            <th className="px-3 py-2.5 font-semibold">Ambulance</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Location</th>
            <th className="px-3 py-2.5 font-semibold">Distance</th>
            <th className="px-5 py-2.5 font-semibold">ETA</th>
          </tr>
        </thead>
        <tbody>
          {data.ambulances.map((ambulance, index) => (
            <tr
              key={ambulance.ambulanceId}
              className={`border-t border-ink-200/60 transition hover:bg-ink-100/40 ${
                ambulance.isNearest ? 'bg-brand-50/40' : ''
              }`}
            >
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold ${
                      index === 0
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {ambulance.isNearest ? (
                    <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                      nearest
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-3">
                <p className="text-[12.5px] font-semibold text-ink-900">
                  {ambulance.regNo}
                </p>
                <p className="font-mono text-[10.5px] text-ink-400">
                  {ambulance.ambulanceId}
                </p>
              </td>
              <td className="px-3 py-3">
                <AmbulanceStatusChip status={ambulance.status} />
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
                  <MapPin size={12} className="shrink-0 text-ink-400" />
                  {ambulance.location.label}
                </span>
                <p className="mt-0.5 font-mono text-[10.5px] text-ink-400">
                  {ambulance.location.lat}, {ambulance.location.lon}
                </p>
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tabular-nums text-ink-800">
                  <Navigation size={12} className="text-brand-600" />
                  {ambulance.distanceKm.toFixed(2)} km
                </span>
              </td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tabular-nums text-ink-800">
                  <Timer size={12} className="text-ink-400" />
                  {ambulance.etaMinutes} min
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex items-center gap-1.5 border-t border-ink-200/60 px-5 py-2.5 text-[11.5px] text-ink-400">
        <AmbulanceIcon size={12} /> Straight-line Haversine distance at{' '}
        {data.search.speedKmh} km/h average speed; road distance and traffic are not
        modelled.
      </p>
    </div>
  );
}
