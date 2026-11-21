import { BedDouble, Droplets, Pill } from 'lucide-react';
import type { HospitalSummary } from '../../lib/types';
import { ProgressBar } from '../ui/Card';

export function HospitalSnapshot({ hospitals }: { hospitals: HospitalSummary[] }) {
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="table-head">
            <th className="px-5 py-2.5 font-semibold">Hospital</th>
            <th className="px-3 py-2.5 font-semibold">Free / total beds</th>
            <th className="px-3 py-2.5 font-semibold">Blood units</th>
            <th className="px-3 py-2.5 font-semibold">O+ units</th>
            <th className="px-3 py-2.5 font-semibold">Adrenaline</th>
            <th className="px-5 py-2.5 font-semibold">Medicines tracked</th>
          </tr>
        </thead>
        <tbody>
          {hospitals.map((hospital) => {
            const freeShare =
              hospital.totalBeds === 0
                ? 0
                : Math.round((hospital.freeBeds / hospital.totalBeds) * 100);
            return (
              <tr
                key={hospital.hospitalId}
                className="border-t border-ink-200/60 transition hover:bg-ink-100/40"
              >
                <td className="px-5 py-3">
                  <p className="text-[12.5px] font-semibold text-ink-900">
                    {hospital.name}
                  </p>
                  <p className="text-[11px] text-ink-400">{hospital.area}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium tabular-nums text-ink-800">
                    <BedDouble size={12} className="text-ink-400" />
                    {hospital.freeBeds} / {hospital.totalBeds}
                  </p>
                  <ProgressBar
                    value={freeShare}
                    tone={hospital.freeBeds === 0 ? 'danger' : freeShare > 15 ? 'success' : 'warning'}
                    className="mt-1.5 w-24"
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-ink-700">
                    <Droplets size={12} className="text-red-500" />
                    {hospital.bloodUnits}
                  </span>
                </td>
                <td className="px-3 py-3 text-[12px] font-medium tabular-nums text-ink-800">
                  {hospital.oPositiveUnits}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-ink-700">
                    <Pill size={12} className="text-brand-500" />
                    {hospital.adrenalineUnits}
                  </span>
                </td>
                <td className="px-5 py-3 text-[12px] tabular-nums text-ink-700">
                  {hospital.medicinesTracked} of 6
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
