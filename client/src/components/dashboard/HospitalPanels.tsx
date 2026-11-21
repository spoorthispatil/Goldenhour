import { Clock3, Droplets, MapPin, Pill, Timer, TriangleAlert } from 'lucide-react';
import type { BloodGroup, HospitalDashboardData } from '../../lib/types';
import { SeverityBadge } from '../ui/Badges';
import { EmptyState, ProgressBar } from '../ui/Card';

const BLOOD_ORDER: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export function BloodInventory({
  stock,
}: {
  stock: HospitalDashboardData['bloodStock'];
}) {
  const ordered = BLOOD_ORDER.map(
    (group) =>
      stock.find((entry) => entry.group === group) ?? {
        group,
        units: 0,
        minimum: 0,
      },
  );

  return (
    <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-4">
      {ordered.map((entry) => {
        const low = entry.units <= entry.minimum;
        return (
          <div
            key={entry.group}
            className={`rounded-xl border px-3 py-2.5 ${
              low ? 'border-red-200 bg-red-50/60' : 'border-ink-200/70 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-900">
                <Droplets size={11} className="text-red-500" />
                {entry.group}
              </span>
              {low ? <TriangleAlert size={12} className="text-critical" /> : null}
            </div>
            <p className="mt-1.5 text-[19px] font-bold leading-none tabular-nums text-ink-900">
              {entry.units}
              <span className="ml-1 text-[10px] font-medium text-ink-400">units</span>
            </p>
            <p className="mt-1 text-[10px] text-ink-400">
              {low ? 'below minimum' : `min ${entry.minimum}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function MedicineInventory({
  stock,
}: {
  stock: HospitalDashboardData['medicineStock'];
}) {
  return (
    <ul className="divide-y divide-ink-200/60">
      {stock.map((entry) => {
        const percent =
          entry.minimum === 0
            ? 100
            : Math.min(100, Math.round((entry.units / (entry.minimum * 3)) * 100));
        return (
          <li key={entry.medicine} className="px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-ink-800">
                <Pill size={12} className="shrink-0 text-brand-500" />
                <span className="truncate">{entry.medicine}</span>
              </span>
              <span
                className={`shrink-0 text-[12px] font-bold tabular-nums ${
                  entry.units <= entry.minimum ? 'text-critical' : 'text-ink-900'
                }`}
              >
                {entry.units}
                <span className="ml-1 text-[10px] font-medium text-ink-400">units</span>
              </span>
            </div>
            <ProgressBar
              value={percent}
              tone={entry.units <= entry.minimum ? 'danger' : 'brand'}
              className="mt-1.5"
            />
          </li>
        );
      })}
    </ul>
  );
}

export function IncomingPatients({
  incoming,
}: {
  incoming: HospitalDashboardData['incoming'];
}) {
  if (incoming.length === 0) {
    return (
      <EmptyState
        title="No incoming patients"
        description="Patients assigned to this hospital by the dispatcher will appear here."
      />
    );
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-5 py-2.5 font-semibold">Request</th>
            <th className="px-3 py-2.5 font-semibold">Patient</th>
            <th className="px-3 py-2.5 font-semibold">Severity</th>
            <th className="px-3 py-2.5 font-semibold">Requirements</th>
            <th className="px-3 py-2.5 font-semibold">Ambulance</th>
            <th className="px-3 py-2.5 font-semibold">ETA</th>
            <th className="px-5 py-2.5 font-semibold">Readiness</th>
          </tr>
        </thead>
        <tbody>
          {incoming.map((patient) => (
            <tr
              key={patient.requestId}
              className="border-t border-ink-200/60 transition hover:bg-ink-100/40"
            >
              <td className="px-5 py-3 text-[12.5px] font-semibold text-ink-900">
                {patient.requestId}
              </td>
              <td className="px-3 py-3">
                <p className="text-[12.5px] font-medium text-ink-800">
                  {patient.patientName}
                </p>
                <p className="text-[11px] text-ink-400">{patient.patientAge} yrs</p>
              </td>
              <td className="px-3 py-3">
                <SeverityBadge severity={patient.severity} />
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  {patient.bloodGroupNeeded ? (
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700">
                      {patient.bloodGroupNeeded}
                    </span>
                  ) : null}
                  {patient.medicineNeeded ? (
                    <span className="max-w-[130px] truncate rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">
                      {patient.medicineNeeded}
                    </span>
                  ) : null}
                  {!patient.bloodGroupNeeded && !patient.medicineNeeded ? (
                    <span className="text-[11px] text-ink-400">Bed only</span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-3">
                <p className="text-[12px] font-medium text-ink-700">
                  {patient.ambulanceRegNo}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-400">
                  <MapPin size={10} /> {patient.ambulanceDistanceKm} km away
                </p>
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums text-ink-800">
                  <Timer size={12} className="text-ink-400" />
                  {patient.etaMinutes} min
                </span>
                <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-400">
                  <Clock3 size={10} /> en route
                </p>
              </td>
              <td className="px-5 py-3">
                <span className="text-[12px] font-bold tabular-nums text-ink-900">
                  {patient.readinessScore}
                  <span className="text-[10px] font-medium text-ink-400">/100</span>
                </span>
                {patient.partialFlag ? (
                  <p className="text-[10.5px] font-semibold text-amber-600">
                    partial readiness
                  </p>
                ) : (
                  <p className="text-[10.5px] text-emerald-600">fully ready</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
