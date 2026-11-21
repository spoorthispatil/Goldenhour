import {
  Activity,
  Ambulance,
  BedDouble,
  Building2,
  ClipboardCheck,
  Clock3,
  Gauge,
  HeartPulse,
  PlusCircle,
  Radar,
  Siren,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { AssignmentList } from '../components/dashboard/AssignmentList';
import { DatabasePanel } from '../components/dashboard/DatabasePanel';
import { FleetPanel } from '../components/dashboard/FleetPanel';
import { HospitalSnapshot } from '../components/dashboard/HospitalSnapshot';
import { QueueTable } from '../components/dashboard/QueueTable';
import { SeverityDonut } from '../components/charts/SeverityDonut';
import { VolumeChart } from '../components/charts/VolumeChart';
import { Card, CardHeader, ErrorState, LoadingBlock } from '../components/ui/Card';
import { LiveBadge } from '../components/ui/Badges';
import { StatCard } from '../components/ui/StatCard';
import { usePolledResource } from '../lib/usePolledResource';
import type { DispatcherDashboardData } from '../lib/types';
import { formatWaiting } from '../lib/severity';

const FEED_TONE: Record<string, string> = {
  critical: 'bg-critical',
  success: 'bg-stable',
  warning: 'bg-medium',
  info: 'bg-brand-500',
};

export function DispatcherDashboardPage() {
  const { data, error, loading, lastUpdated, refresh } =
    usePolledResource<DispatcherDashboardData>('/dashboard/dispatcher', 5000);

  return (
    <AppShell
      title="Emergency command center"
      subtitle="Severity ranking, ambulance search and hospital readiness in one console"
      onRefresh={refresh}
    >
      {loading && !data ? (
        <Card>
          <LoadingBlock label="Loading dispatcher overview" />
        </Card>
      ) : null}

      {error && !data ? <Card><ErrorState message={error} onRetry={refresh} /></Card> : null}

      {data ? (
        <div className="space-y-5">
          <PageHeader
            eyebrow="Live overview"
            title="Dispatch situation report"
            description="Every tile below is aggregated from PostgreSQL through Prisma. The queue is ordered by the database using the severity rule, then by waiting time."
            action={
              <div className="flex flex-wrap items-end justify-end gap-3">
                <Link
                  to="/dispatcher/emergency/new"
                  className="btn-primary !px-4 !py-2"
                >
                  <PlusCircle size={15} /> Register emergency
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
              label="Total emergencies"
              value={data.stats.totalEmergencies}
              hint="Open and recently closed calls"
              icon={Siren}
              tone="brand"
            />
            <StatCard
              label="Critical"
              value={data.stats.criticalEmergencies}
              hint="Weight 4 - served first"
              icon={HeartPulse}
              tone="critical"
            />
            <StatCard
              label="Pending requests"
              value={data.stats.pendingRequests}
              hint="Waiting in the priority queue"
              icon={Clock3}
              tone="warning"
            />
            <StatCard
              label="Active assignments"
              value={data.stats.activeAssignments}
              hint="Ambulance and bed reserved"
              icon={ClipboardCheck}
              tone="brand"
            />
            <StatCard
              label="Ambulances available"
              value={data.stats.availableAmbulances}
              hint={`${data.stats.busyAmbulances} busy - ${data.stats.offlineAmbulances} offline`}
              icon={Ambulance}
              tone="success"
            />
            <StatCard
              label="Busy ambulances"
              value={data.stats.busyAmbulances}
              hint="On an active assignment"
              icon={Activity}
              tone="warning"
            />
            <StatCard
              label="Hospitals"
              value={data.stats.totalHospitals}
              hint="In the readiness network"
              icon={Building2}
              tone="neutral"
            />
            <StatCard
              label="Free beds"
              value={data.stats.freeBeds}
              hint="Across all hospitals"
              icon={BedDouble}
              tone="success"
            />
          </div>

          <Card>
            <CardHeader
              title="Live priority queue"
              subtitle="CRITICAL first, then HIGH, MEDIUM and LOW; equal severity is ordered by longest wait"
              icon={Gauge}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/dispatcher/queue"
                    className="text-[11.5px] font-semibold text-brand-700 hover:underline"
                  >
                    Open queue board →
                  </Link>
                  <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                    {data.queue.length} open
                  </span>
                  <span className="text-[11px] text-ink-400">
                    longest wait{' '}
                    {formatWaiting(
                      Math.max(0, ...data.queue.map((item) => item.waitingMinutes)),
                    )}
                  </span>
                </div>
              }
            />
            <QueueTable items={data.queue} limit={7} />
          </Card>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader
                title="Severity mix"
                subtitle="Open requests by severity weight"
                icon={HeartPulse}
              />
              <div className="card-pad">
                <SeverityDonut data={data.severityBreakdown} />
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader
                title="Emergency volume"
                subtitle="Calls received per hour today"
                icon={Activity}
                action={
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                    <Radar size={12} /> trending
                  </span>
                }
              />
              <div className="px-3 pb-4 pt-4 sm:px-4">
                <VolumeChart data={data.volumeByHour} />
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Recent assignments"
                subtitle="Ambulance and hospital already reserved"
                icon={ClipboardCheck}
                action={
                  <Link
                    to="/dispatcher/assignments"
                    className="text-[11.5px] font-semibold text-brand-700 hover:underline"
                  >
                    Open assignment desk →
                  </Link>
                }
              />
              <AssignmentList assignments={data.assignments} />
            </Card>

            <Card>
              <CardHeader
                title="Ambulance fleet"
                subtitle="Only AVAILABLE vehicles are eligible for dispatch"
                icon={Ambulance}
                action={
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    {data.stats.availableAmbulances} free
                  </span>
                }
              />
              <FleetPanel ambulances={data.ambulances} />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Hospital readiness snapshot"
              subtitle="Live bed capacity and stock. Readiness scoring (40 blood + 40 medicine + 20 nearness) now ranks hospitals in Hospital matching."
              icon={Building2}
              action={
                <Link
                  to="/dispatcher/hospitals"
                  className="text-[11.5px] font-semibold text-brand-700 hover:underline"
                >
                  Open hospital matching →
                </Link>
              }
            />
            <HospitalSnapshot hospitals={data.hospitals} />
          </Card>

          <DatabasePanel />

          <Card>
            <CardHeader
              title="Activity feed"
              subtitle="Derived from the newest request, assignments and stock state in the database"
              icon={Activity}
            />
            <ul className="divide-y divide-ink-200/60">
              {data.statusFeed.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 px-5 py-3 text-[12.5px]"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      FEED_TONE[entry.tone] ?? 'bg-ink-300'
                    }`}
                  />
                  <p className="flex-1 text-ink-700">{entry.message}</p>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-400">
                    {new Date(entry.at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
