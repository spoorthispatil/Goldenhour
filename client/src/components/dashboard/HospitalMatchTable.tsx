import { BedDouble, MapPin, Navigation } from 'lucide-react';
import type { HospitalReadiness } from '../../lib/types';
import { EmptyState } from '../ui/Card';

function ComponentScore({
  points,
  max,
  required,
  detail,
}: {
  points: number;
  max: number;
  required: boolean;
  detail: string;
}) {
  if (!required) {
    return (
      <div>
        <p className="text-[11.5px] font-semibold text-emerald-700">
          {points}/{max}
        </p>
        <p className="text-[10.5px] text-ink-400">not required</p>
      </div>
    );
  }
  return (
    <div>
      <p
        className={`text-[11.5px] font-semibold ${
          points === max ? 'text-emerald-700' : 'text-red-600'
        }`}
      >
        {points}/{max}
      </p>
      <p className="text-[10.5px] text-ink-400">{detail}</p>
    </div>
  );
}

export function HospitalMatchTable({ hospitals }: { hospitals: HospitalReadiness[] }) {
  if (hospitals.length === 0) {
    return (
      <EmptyState
        title="No hospital with a free bed"
        description="Every hospital currently reports zero free beds, so none is eligible for scoring. Free beds are maintained by hospital staff."
      />
    );
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-5 py-2.5 font-semibold">Rank</th>
            <th className="px-3 py-2.5 font-semibold">Hospital</th>
            <th className="px-3 py-2.5 font-semibold">Distance</th>
            <th className="px-3 py-2.5 font-semibold">Blood /40</th>
            <th className="px-3 py-2.5 font-semibold">Medicine /40</th>
            <th className="px-3 py-2.5 font-semibold">Nearness /20</th>
            <th className="px-5 py-2.5 font-semibold">Readiness</th>
          </tr>
        </thead>
        <tbody>
          {hospitals.map((hospital) => (
            <tr
              key={hospital.hospitalId}
              className={`border-t border-ink-200/60 transition hover:bg-ink-100/40 ${
                hospital.rank === 1 ? 'bg-brand-50/40' : ''
              }`}
            >
              <td className="px-5 py-3">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg text-[12px] font-bold ${
                    hospital.rank === 1
                      ? 'bg-brand-600 text-white'
                      : 'bg-ink-100 text-ink-600'
                  }`}
                >
                  {hospital.rank}
                </span>
              </td>
              <td className="max-w-[280px] px-3 py-3">
                <p className="text-[12.5px] font-semibold text-ink-900">
                  {hospital.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                  <MapPin size={10} className="shrink-0 text-ink-400" />
                  {hospital.area}
                  <span className="mx-1 text-ink-300">·</span>
                  <BedDouble size={10} className="shrink-0 text-ink-400" />
                  {hospital.freeBeds}/{hospital.totalBeds} free
                </p>
                <p
                  className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-ink-400"
                  title={hospital.reason}
                >
                  {hospital.reason}
                </p>
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums text-ink-800">
                  <Navigation size={12} className="text-brand-600" />
                  {hospital.distanceKm.toFixed(2)} km
                </span>
              </td>
              <td className="px-3 py-3">
                <ComponentScore
                  points={hospital.components.blood.points}
                  max={hospital.components.blood.max}
                  required={hospital.components.blood.required}
                  detail={
                    hospital.components.blood.required
                      ? `${hospital.components.blood.group}: ${
                          hospital.components.blood.units ?? 0
                        } units`
                      : ''
                  }
                />
              </td>
              <td className="px-3 py-3">
                <ComponentScore
                  points={hospital.components.medicine.points}
                  max={hospital.components.medicine.max}
                  required={hospital.components.medicine.required}
                  detail={
                    hospital.components.medicine.required
                      ? `${hospital.components.medicine.units ?? 0} units`
                      : ''
                  }
                />
              </td>
              <td className="px-3 py-3">
                <p className="text-[11.5px] font-semibold text-ink-800">
                  {hospital.components.nearness.points}
                  <span className="text-ink-400">
                    /{hospital.components.nearness.max}
                  </span>
                </p>
                <p className="text-[10.5px] text-ink-400">
                  25 km decay
                </p>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold tabular-nums text-ink-900">
                    {hospital.score}
                  </span>
                  <span className="text-[10.5px] text-ink-400">/100</span>
                  {hospital.partialFlag ? (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      partial
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full ${
                      hospital.score >= 80
                        ? 'bg-stable'
                        : hospital.score >= 50
                          ? 'bg-medium'
                          : 'bg-critical'
                    }`}
                    style={{ width: `${Math.max(4, Math.min(100, hospital.score))}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
