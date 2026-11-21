import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  ListOrdered,
  PlusCircle,
  Siren,
  Timer,
  Trophy,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { PriorityQueueTable } from '../components/dashboard/PriorityQueueTable';
import { Card, CardHeader, ErrorState, LoadingBlock } from '../components/ui/Card';
import { LiveBadge, SeverityBadge } from '../components/ui/Badges';
import { StatCard } from '../components/ui/StatCard';
import { usePolledResource } from '../lib/usePolledResource';
import type { PriorityQueueData } from '../lib/types';
import { formatWaiting, SEVERITY_ORDER, SEVERITY_STYLE } from '../lib/severity';

export function PriorityQueuePage() {
  const { data, error, loading, lastUpdated, refresh } =
    usePolledResource<PriorityQueueData>('/queue', 5000);

  return (
    <AppShell
      title="Priority queue"
      subtitle="Severity ranking recomputed from PostgreSQL on every refresh"
      onRefresh={refresh}
    >
      <Link
        to="/dispatcher"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to command center
      </Link>

      {loading && !data ? (
        <Card>
          <LoadingBlock label="Ranking the open queue" />
        </Card>
      ) : null}

      {error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={refresh} />
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-5">
          <PageHeader
            eyebrow="Ranking engine"
            title="Severity-first priority queue"
            description="Every queued call is scored from its severity weight and its waiting time. The ranked list below is the exact order in which calls should be dispatched."
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
              Showing the last successful ranking. Newest attempt failed: {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="In queue"
              value={data.stats.queued}
              hint={
                data.stats.nextUp
                  ? `Next up ${data.stats.nextUp.requestId}`
                  : 'Nothing waiting'
              }
              icon={ListOrdered}
              tone="brand"
            />
            <StatCard
              label="Critical waiting"
              value={data.stats.criticalWaiting}
              hint="Weight 4 - always served first"
              icon={Siren}
              tone="critical"
            />
            <StatCard
              label="Longest wait"
              value={formatWaiting(data.stats.longestWaitMinutes)}
              hint={`Average ${formatWaiting(data.stats.averageWaitMinutes)}`}
              icon={Timer}
              tone="warning"
            />
            <StatCard
              label="In progress"
              value={data.stats.inProgress}
              hint="Assigned, not yet closed"
              icon={ClipboardList}
              tone="neutral"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <Card>
              <CardHeader
                title="Ranked queue"
                subtitle="CRITICAL first; equal severity is ordered by longest wait"
                icon={ListOrdered}
                action={
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                      {data.stats.queued} queued
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                      <Siren size={11} /> live recalculation
                    </span>
                  </div>
                }
              />
              <PriorityQueueTable items={data.items} />
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader
                  title="Ranking rule"
                  subtitle="Severity ranking"
                  icon={Trophy}
                />
                <div className="card-pad space-y-3.5">
                  <code className="block overflow-x-auto rounded-lg bg-ink-900 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-emerald-200">
                    {data.algorithm.formula}
                  </code>

                  <div className="grid grid-cols-2 gap-2">
                    {SEVERITY_ORDER.map((severity) => (
                      <div
                        key={severity}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${SEVERITY_STYLE[severity].chip}`}
                      >
                        <span className="text-[11.5px] font-semibold">
                          {SEVERITY_STYLE[severity].label}
                        </span>
                        <span className="font-mono text-[11px] font-bold">
                          ×{data.algorithm.weights[severity]}
                        </span>
                      </div>
                    ))}
                  </div>

                  <ul className="space-y-2 text-[11.5px] leading-relaxed text-ink-600">
                    <li>
                      The weight is multiplied by {data.algorithm.dominanceFactor}, so a
                      CRITICAL always outranks a HIGH however long the HIGH has waited.
                    </li>
                    <li>
                      Waiting minutes are capped at {data.algorithm.waitingCapMinutes},
                      which is why waiting can never cross into a higher severity band.
                    </li>
                    <li>
                      Same severity and same minute: the older call wins, then the lower
                      request ID keeps the order deterministic.
                    </li>
                  </ul>

                  {data.items[0] ? (
                    <div className="rounded-lg border border-ink-200/70 bg-canvas/70 p-3">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                        Top call breakdown
                      </p>
                      <p className="mt-1 font-mono text-[11.5px] text-ink-700">
                        {`${data.items[0].severityWeight} × ${data.algorithm.dominanceFactor} + min(${data.items[0].waitingMinutes}, ${data.algorithm.waitingCapMinutes}) = ${data.items[0].priorityScore}`}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-500">
                        {data.items[0].requestId} - {data.items[0].patientName}
                      </p>
                    </div>
                  ) : null}

                  <p className="text-[11px] text-ink-400">
                    Recomputed from PostgreSQL on each request. Socket.IO pushes a change
                    signal, so created and closed cases appear instantly; a 20-second
                    poll remains as a fallback if the socket is down.
                  </p>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="In progress"
                  subtitle="Already assigned, excluded from the waiting ranks"
                  icon={ClipboardList}
                  action={
                    <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                      {data.stats.inProgress}
                    </span>
                  }
                />
                {data.inProgress.length === 0 ? (
                  <p className="px-5 py-6 text-[12px] text-ink-500">
                    No assigned cases right now. Assignments made on the desk appear here.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-200/60">
                    {data.inProgress.map((item) => (
                      <li
                        key={item.requestId}
                        className="flex flex-wrap items-center gap-2 px-5 py-2.5"
                      >
                        <SeverityBadge severity={item.severity} />
                        <span className="text-[12px] font-semibold text-ink-900">
                          {item.requestId}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-500">
                          {item.patientName} - {item.area}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-ink-500">
                          <Timer size={11} /> {formatWaiting(item.waitingMinutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
