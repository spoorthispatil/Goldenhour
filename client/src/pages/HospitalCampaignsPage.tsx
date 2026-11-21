import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Droplets,
  HeartPulse,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Send,
  Users,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';
import type {
  BloodGroup,
  CampaignAudience,
  CampaignDeliveryReport,
  CampaignDeliverySummary,
  CampaignType,
  DonationCampaign,
  NotificationChannel,
} from '../lib/types';
import { usePolledResource } from '../lib/usePolledResource';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const CHANNEL_OPTIONS: {
  key: NotificationChannel;
  label: string;
  hint: string;
  icon: typeof Mail;
}[] = [
  { key: 'EMAIL', label: 'Email', hint: 'Resend', icon: Mail },
  { key: 'SMS', label: 'SMS', hint: 'Twilio', icon: MessageSquare },
  { key: 'PUSH', label: 'Push', hint: 'Browser push', icon: Bell },
];

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  PUSH: 'Push',
};

function defaultStart(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function audienceLabel(campaign: DonationCampaign): string {
  if (campaign.audience === 'CITY') return `Patients in ${campaign.audienceValue}`;
  if (campaign.audience === 'BLOOD_GROUP') {
    return `Patients with ${campaign.audienceValue} blood group`;
  }
  return 'All patients';
}

function DeliveryStats({ delivery }: { delivery: CampaignDeliverySummary }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-600">
        <span className="inline-flex items-center gap-1 font-semibold text-ink-800">
          <Users size={12} /> {delivery.recipients} recipient(s)
        </span>
        <span className="text-emerald-700">{delivery.sent} sent</span>
        <span className="text-ink-500">{delivery.skipped} skipped</span>
        <span className={delivery.failed ? 'text-red-700' : 'text-ink-500'}>
          {delivery.failed} failed
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-ink-500 sm:grid-cols-3">
        {(Object.keys(delivery.channels) as NotificationChannel[]).map((channel) => (
          <span key={channel}>
            <span className="font-semibold text-ink-700">{CHANNEL_LABEL[channel]}</span>:{' '}
            {delivery.channels[channel].sent} sent · {delivery.channels[channel].skipped} skipped ·{' '}
            {delivery.channels[channel].failed} failed
          </span>
        ))}
      </div>
      {Object.keys(delivery.skippedReasons).length > 0 ? (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
          Skipped:{' '}
          {Object.entries(delivery.skippedReasons)
            .map(([reason, count]) => `${reason.toLowerCase().replaceAll('_', ' ')} (${count})`)
            .join(', ')}
        </p>
      ) : null}
      {delivery.truncated ? (
        <p className="mt-1 text-[10.5px] text-medium">
          Only the first 500 matching patients were contacted.
        </p>
      ) : null}
    </div>
  );
}

export function HospitalCampaignsPage() {
  const { data, error, loading, refresh } = usePolledResource<{
    campaigns: DonationCampaign[];
  }>('/hospital/campaigns', 15000);

  const [type, setType] = useState<CampaignType>('BLOOD_DONATION');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [audience, setAudience] = useState<CampaignAudience>('ALL');
  const [audienceValue, setAudienceValue] = useState('');
  const [channels, setChannels] = useState<NotificationChannel[]>(['EMAIL', 'SMS', 'PUSH']);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<CampaignDeliverySummary | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [report, setReport] = useState<CampaignDeliveryReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((entry) => entry !== channel)
        : [...current, channel],
    );
  };

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    setDelivery(null);
    setSubmitting(true);
    try {
      const response = await api.post<{
        message: string;
        delivery: CampaignDeliverySummary;
      }>('/hospital/campaigns', {
        type,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startsAt: new Date(startsAt).toISOString(),
        audience,
        audienceValue: audience === 'ALL' ? null : audienceValue.trim(),
        channels,
      });
      setMessage(response.data.message);
      setDelivery(response.data.delivery);
      setTitle('');
      setDescription('');
      setLocation('');
      refresh();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openReport = async (campaignId: string) => {
    if (reportFor === campaignId) {
      setReportFor(null);
      return;
    }
    setReportFor(campaignId);
    setReport(null);
    setReportLoading(true);
    try {
      const response = await api.get<CampaignDeliveryReport>(
        `/hospital/campaigns/${campaignId}/delivery`,
      );
      setReport(response.data);
    } catch (err) {
      setFormError(describeApiError(err));
      setReportFor(null);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <AppShell
      title="Donation campaigns"
      subtitle="Target patients and deliver campaigns by email, SMS and browser push"
      onRefresh={refresh}
    >
      <PageHeader
        eyebrow="Patient services"
        title="Publish a donation camp"
        description="Choose who should receive the campaign and how it should reach them. The in-app feed always gets it; email, SMS and push are recorded per patient in the delivery report."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader title="New campaign" icon={Megaphone} />
          <form className="card-pad space-y-3" onSubmit={(event) => void publish(event)}>
            <div>
              <label htmlFor="campaignType" className="label">
                Campaign type
              </label>
              <select
                id="campaignType"
                className="input"
                value={type}
                onChange={(event) => setType(event.target.value as CampaignType)}
              >
                <option value="BLOOD_DONATION">Blood donation</option>
                <option value="ORGAN_DONATION">Organ donation</option>
              </select>
            </div>

            <div>
              <label htmlFor="campaignTitle" className="label">
                Title
              </label>
              <input
                id="campaignTitle"
                className="input"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="World Blood Donor Day camp"
              />
            </div>

            <div>
              <label htmlFor="campaignDescription" className="label">
                Description
              </label>
              <textarea
                id="campaignDescription"
                className="input min-h-[88px]"
                value={description}
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Who can donate, what to bring, and how the camp helps patients."
              />
            </div>

            <div>
              <label htmlFor="campaignLocation" className="label">
                Location
              </label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="campaignLocation"
                  className="input !pl-9"
                  value={location}
                  maxLength={160}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Hospital auditorium, Vidyanagar"
                />
              </div>
            </div>

            <div>
              <label htmlFor="campaignStartsAt" className="label">
                Starts at
              </label>
              <input
                id="campaignStartsAt"
                type="datetime-local"
                className="input"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>

            <div className="rounded-xl border border-ink-200 p-3">
              <label htmlFor="campaignAudience" className="label">
                Target audience
              </label>
              <select
                id="campaignAudience"
                className="input"
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value as CampaignAudience);
                  setAudienceValue('');
                }}
              >
                <option value="ALL">All patients</option>
                <option value="CITY">Patients in a city</option>
                <option value="BLOOD_GROUP">Patients with a blood group</option>
              </select>

              {audience === 'CITY' ? (
                <input
                  className="input mt-2"
                  value={audienceValue}
                  maxLength={80}
                  onChange={(event) => setAudienceValue(event.target.value)}
                  placeholder="City, e.g. Hubballi"
                  aria-label="City"
                />
              ) : null}

              {audience === 'BLOOD_GROUP' ? (
                <select
                  className="input mt-2"
                  value={audienceValue}
                  onChange={(event) => setAudienceValue(event.target.value)}
                  aria-label="Blood group"
                >
                  <option value="">Choose a blood group</option>
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              ) : null}

              <p className="mt-1.5 text-[10.5px] text-ink-400">
                Patients add their city and blood group in Notifications → Delivery settings.
              </p>
            </div>

            <div>
              <span className="label">Delivery channels</span>
              <div className="grid grid-cols-3 gap-2">
                {CHANNEL_OPTIONS.map(({ key, label, hint, icon: Icon }) => {
                  const selected = channels.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleChannel(key)}
                      className={`rounded-xl border px-2 py-2 text-left transition ${
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 bg-white text-ink-500 hover:border-brand-300'
                      }`}
                    >
                      <Icon size={14} />
                      <span className="mt-1 block text-[11.5px] font-semibold">{label}</span>
                      <span className="block text-[10px] text-ink-400">{hint}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10.5px] text-ink-400">
                A channel needs a configured provider; otherwise it is recorded as skipped, never
                silently dropped.
              </p>
            </div>

            {formError ? (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {formError}
              </div>
            ) : null}
            {message ? (
              <div className="space-y-2">
                <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-800">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {message}
                </div>
                {delivery ? <DeliveryStats delivery={delivery} /> : null}
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  <Send size={15} /> Publish campaign
                </>
              )}
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Published campaigns"
            subtitle="In-app feed plus the selected outbound channels"
            icon={CalendarDays}
            action={
              <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                {data?.campaigns.length ?? 0}
              </span>
            }
          />
          {loading && !data ? <LoadingBlock label="Loading campaigns" /> : null}
          {error && !data ? <ErrorState message={error} onRetry={refresh} /> : null}
          {data && data.campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Publish your first blood or organ donation camp with the form."
            />
          ) : null}
          {data && data.campaigns.length > 0 ? (
            <ul className="divide-y divide-ink-200/60">
              {data.campaigns.map((campaign) => (
                <li key={campaign.campaignId} className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {campaign.type === 'BLOOD_DONATION' ? (
                      <Droplets size={14} className="text-critical" />
                    ) : (
                      <HeartPulse size={14} className="text-brand-600" />
                    )}
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-400">
                      {campaign.type === 'BLOOD_DONATION'
                        ? 'Blood donation'
                        : 'Organ donation'}
                    </p>
                  </div>
                  <p className="mt-1 text-[12.5px] font-semibold text-ink-900">
                    {campaign.title}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {new Date(campaign.startsAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}{' '}
                    · {campaign.location}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} /> {audienceLabel(campaign)}
                    </span>
                    {campaign.channels.length > 0 ? (
                      <span className="text-ink-400">
                        {' '}
                        · {campaign.channels.map((channel) => CHANNEL_LABEL[channel]).join(', ')}
                      </span>
                    ) : (
                      <span className="text-ink-400"> · In-app only</span>
                    )}
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 transition hover:text-brand-700"
                    onClick={() => void openReport(campaign.campaignId)}
                  >
                    <BarChart3 size={12} />
                    {reportFor === campaign.campaignId ? 'Hide delivery report' : 'Delivery report'}
                  </button>
                  {reportFor === campaign.campaignId ? (
                    <div className="mt-2">
                      {reportLoading ? (
                        <p className="text-[11px] text-ink-500">Loading delivery report…</p>
                      ) : report ? (
                        <div className="space-y-2">
                          <DeliveryStats delivery={report.summary} />
                          <ul className="space-y-1 text-[11px] text-ink-600">
                            {report.notifications.slice(0, 12).map((row) => (
                              <li key={row.notificationId} className="flex justify-between gap-2">
                                <span className="truncate">
                                  {row.patientName} · {CHANNEL_LABEL[row.channel]}
                                </span>
                                <span
                                  className={
                                    row.status === 'SENT'
                                      ? 'text-emerald-700'
                                      : row.status === 'FAILED'
                                        ? 'text-red-700'
                                        : 'text-ink-400'
                                  }
                                >
                                  {row.status.toLowerCase()}
                                  {row.detail ? ` (${row.detail})` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {report.notifications.length === 0 ? (
                            <p className="text-[11px] text-ink-400">
                              No outbound attempts were recorded for this campaign.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
