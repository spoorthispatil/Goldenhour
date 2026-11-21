import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarCheck,
  HeartPulse,
  MapPin,
  Siren,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Card';
import { RequestStatusChip, SeverityBadge } from '../components/ui/Badges';
import { StatCard } from '../components/ui/StatCard';
import { usePolledResource } from '../lib/usePolledResource';
import type { PatientOverview } from '../lib/types';

const PREBOOKING_LABEL: Record<string, string> = {
  PENDING: 'Awaiting hospital',
  CONFIRMED: 'Bed reserved',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  CANCEL_REQUESTED: 'Cancellation requested',
  ADMITTED: 'Admitted',
  DISCHARGED: 'Discharged',
};

export function PatientDashboardPage() {
  const { data, error, loading, lastUpdated, refresh } =
    usePolledResource<PatientOverview>('/patient/overview', 10000);

  return (
    <AppShell
      title={data ? `Hello, ${data.profile.name}` : 'Patient portal'}
      subtitle="Call an ambulance, check hospitals and follow donation camps"
      onRefresh={refresh}
    >
      {loading && !data ? (
        <Card>
          <LoadingBlock label="Loading your patient dashboard" />
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
            eyebrow="Patient portal"
            title={`Welcome, ${data.profile.name}`}
            description={`Patient ID ${data.profile.patientId} · ${data.profile.age} years · ${data.profile.contact}. Your identity is taken from this signed-in account on every request.`}
            action={
              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stable">
                  <span className="h-1.5 w-1.5 rounded-full bg-stable" /> Live
                </span>
                <p className="text-[11px] text-ink-400">
                  Updated{' '}
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString('en-IN', { hour12: true })
                    : '-'}
                </p>
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
              label="Active calls"
              value={data.stats.activeRequests}
              hint="Queued or assigned"
              icon={Siren}
              tone="critical"
            />
            <StatCard
              label="Pre-bookings"
              value={data.stats.upcomingPrebookings}
              hint="Pending or confirmed"
              icon={CalendarCheck}
              tone="success"
            />
            <StatCard
              label="Unread alerts"
              value={data.stats.unreadCampaigns}
              hint="Donation camps"
              icon={BellRing}
              tone="warning"
            />
            <StatCard
              label="Hospitals"
              value={data.stats.hospitals}
              hint="Listed on the network"
              icon={Building2}
              tone="neutral"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                to: '/patient/ambulance',
                icon: Siren,
                title: 'Call an ambulance',
                body: 'Send your location and severity straight into the dispatcher priority queue.',
              },
              {
                to: '/patient/hospitals',
                icon: Building2,
                title: 'Check hospitals',
                body: 'Compare free beds, blood units and medicines, then request a bed in advance.',
              },
              {
                to: '/patient/notifications',
                icon: HeartPulse,
                title: 'Donation camps',
                body: 'Blood donation and organ donation camps published by hospitals appear here.',
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon size={17} />
                  </span>
                  <p className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-ink-900">
                    {action.title}
                    <ArrowRight
                      size={13}
                      className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
                    {action.body}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader
                title="My emergency calls"
                subtitle="Latest calls raised from this account"
                icon={Siren}
                action={
                  <Link
                    to="/patient/ambulance"
                    className="text-[11.5px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    New call
                  </Link>
                }
              />
              {data.recentRequests.length === 0 ? (
                <EmptyState
                  title="No calls yet"
                  description="When you need help, call an ambulance and the dispatcher queue picks it up immediately."
                />
              ) : (
                <ul className="divide-y divide-ink-200/60">
                  {data.recentRequests.map((request) => (
                    <li key={request.requestId} className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-900">
                          {request.requestId}
                          <SeverityBadge severity={request.severity} />
                        </p>
                        <RequestStatusChip status={request.status} />
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-500">
                        <MapPin size={11} />
                        {request.lat.toFixed(4)}, {request.lon.toFixed(4)}
                        {request.hospitalName ? ` · ${request.hospitalName}` : ''}
                        {request.ambulanceRegNo ? ` · ${request.ambulanceRegNo}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader title="My pre-bookings" icon={CalendarCheck} />
                {data.prebookings.length === 0 ? (
                  <EmptyState
                    title="No pre-bookings"
                    description="Check hospital availability and request a bed before you travel."
                  />
                ) : (
                  <ul className="divide-y divide-ink-200/60">
                    {data.prebookings.map((prebooking) => (
                      <li
                        key={prebooking.prebookingId}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold text-ink-900">
                            {prebooking.hospital.name}
                          </p>
                          <p className="text-[11px] text-ink-500">
                            {PREBOOKING_LABEL[prebooking.status]}
                          </p>
                        </div>
                        <span className="rounded-md bg-ink-100 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-600">
                          {prebooking.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Donation alerts" icon={HeartPulse} />
                {data.campaigns.length === 0 ? (
                  <EmptyState
                    title="No campaigns yet"
                    description="Hospitals publish blood and organ donation camps here."
                  />
                ) : (
                  <ul className="divide-y divide-ink-200/60">
                    {data.campaigns.map((campaign) => (
                      <li key={campaign.campaignId} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-600">
                            {campaign.type === 'BLOOD_DONATION'
                              ? 'Blood donation'
                              : 'Organ donation'}
                          </p>
                          {!campaign.read ? (
                            <span className="h-2 w-2 rounded-full bg-critical" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12.5px] font-semibold text-ink-900">
                          {campaign.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          {new Date(campaign.startsAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}{' '}
                          · {campaign.location}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-ink-200/60 px-5 py-3">
                  <Link
                    to="/patient/notifications"
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Open notifications <ArrowRight size={13} />
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
