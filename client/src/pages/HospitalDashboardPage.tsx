import {
  BedDouble,
  BellRing,
  Building2,
  Droplets,
  Info,
  MapPin,
  Pill,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import {
  BloodInventory,
  IncomingPatients,
  MedicineInventory,
} from '../components/dashboard/HospitalPanels';
import { Card, CardHeader, ErrorState, LoadingBlock, ProgressBar } from '../components/ui/Card';
import { LiveBadge } from '../components/ui/Badges';
import { StatCard } from '../components/ui/StatCard';
import { usePolledResource } from '../lib/usePolledResource';
import type { HospitalDashboardData } from '../lib/types';

export function HospitalDashboardPage() {
  const { data, error, loading, lastUpdated, refresh } =
    usePolledResource<HospitalDashboardData>('/dashboard/hospital', 5000);

  const occupied = data ? data.hospital.totalBeds - data.hospital.freeBeds : 0;
  const occupancy = data
    ? Math.round((occupied / Math.max(1, data.hospital.totalBeds)) * 100)
    : 0;

  return (
    <AppShell
      title={data ? data.hospital.name : 'Hospital dashboard'}
      subtitle="Incoming patients, bed capacity and emergency stock"
      onRefresh={refresh}
    >
      {loading && !data ? (
        <Card>
          <LoadingBlock label="Loading hospital overview" />
        </Card>
      ) : null}

      {error && !data ? <Card><ErrorState message={error} onRetry={refresh} /></Card> : null}

      {data ? (
        <div className="space-y-5">
          <PageHeader
            eyebrow="Hospital view"
            title={data.hospital.name}
            description={`${data.hospital.area} - patients assigned here appear below with their ambulance and requirements.`}
            action={
              <div className="flex flex-wrap items-end justify-end gap-3">
                <Link
                  to="/hospital/resources"
                  className="btn-secondary !px-4 !py-2"
                >
                  <SlidersHorizontal size={15} /> Edit beds & stock
                </Link>
                <div className="flex flex-col items-end gap-1.5">
                <LiveBadge polling={Boolean(data)} />
                <p className="text-[11px] text-ink-400">
                  Last sync{' '}
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString('en-IN', { hour12: true })
                    : '-'}
                </p>
                </div>
              </div>
            }
          />

          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
              Showing the last successful sync. Newest attempt failed: {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total beds"
              value={data.hospital.totalBeds}
              hint="Licensed emergency capacity"
              icon={BedDouble}
              tone="neutral"
            />
            <StatCard
              label="Free beds"
              value={data.hospital.freeBeds}
              hint="Eligible for the next match"
              icon={BedDouble}
              tone="success"
            />
            <StatCard
              label="Occupied beds"
              value={occupied}
              hint={`${occupancy}% occupancy`}
              icon={Users}
              tone="warning"
            />
            <StatCard
              label="Incoming patients"
              value={data.incoming.length}
              hint="Assigned and en route"
              icon={BellRing}
              tone="critical"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
            <Card>
              <CardHeader
                title="Bed availability"
                subtitle="Free beds decide whether this hospital is eligible at all"
                icon={BedDouble}
              />
              <div className="card-pad">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[34px] font-bold leading-none text-ink-900">
                      {data.hospital.freeBeds}
                      <span className="ml-1.5 text-[14px] font-medium text-ink-400">
                        free of {data.hospital.totalBeds}
                      </span>
                    </p>
                    <p className="mt-1.5 text-[12px] text-ink-500">
                      {occupied} beds currently occupied by admitted patients.
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${
                      occupancy >= 90
                        ? 'bg-red-50 text-critical'
                        : occupancy >= 70
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {occupancy}% full
                  </span>
                </div>
                <ProgressBar
                  value={occupancy}
                  tone={occupancy >= 90 ? 'danger' : occupancy >= 70 ? 'warning' : 'success'}
                  className="mt-4 h-2"
                />
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Total', value: data.hospital.totalBeds },
                    { label: 'Occupied', value: occupied },
                    { label: 'Free', value: data.hospital.freeBeds },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-ink-200/70 bg-canvas/70 py-2"
                    >
                      <p className="text-[16px] font-bold tabular-nums text-ink-900">
                        {item.value}
                      </p>
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-ink-100/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-600">
                  <SlidersHorizontal size={13} className="mt-0.5 shrink-0 text-ink-400" />
                  These figures are read from PostgreSQL. Hospital staff can update them
                  in Beds & resources; dispatcher matching uses the new values
                  immediately.
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Blood inventory"
                subtitle="Units by group; red cards are below the safety minimum"
                icon={Droplets}
              />
              <BloodInventory stock={data.bloodStock} />
              <div className="flex items-start gap-2 border-t border-ink-200/60 px-5 py-3 text-[11.5px] text-ink-500">
                <Info size={13} className="mt-0.5 shrink-0 text-ink-400" />
                Blood group availability contributes 40 of the 100 readiness points.
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Incoming patients"
              subtitle="Only patients assigned to this hospital - scoped to the session hospital"
              icon={BellRing}
              action={
                <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                  {data.incoming.length} en route
                </span>
              }
            />
            <IncomingPatients incoming={data.incoming} />
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader
                title="Medicine stock"
                subtitle="Critical medicines tracked for readiness"
                icon={Pill}
              />
              <MedicineInventory stock={data.medicineStock} />
            </Card>

            <Card>
              <CardHeader
                title="Hospital profile"
                subtitle="Coordinates are used by the nearest-ambulance and nearness score"
                icon={Building2}
              />
              <dl className="card-pad grid grid-cols-2 gap-4 text-[12.5px]">
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Hospital ID
                  </dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {data.hospital.hospitalId}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Area
                  </dt>
                  <dd className="mt-1 font-semibold text-ink-900">{data.hospital.area}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Location
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink-900">
                    <MapPin size={12} className="text-ink-400" />
                    {data.hospital.lat.toFixed(4)}, {data.hospital.lon.toFixed(4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Network
                  </dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    GoldenHour network
                  </dd>
                </div>
              </dl>
              <div className="mx-5 mb-5 rounded-xl border border-brand-200/70 bg-brand-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-brand-800">
                Hospital staff only ever see their own hospital. Cross-hospital data
                isolation is covered by the automated API tests.
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
