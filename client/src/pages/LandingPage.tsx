import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Activity,
  Ambulance,
  BedDouble,
  Building2,
  HeartPulse,
  CheckCircle2,
  Clock3,
  Droplets,
  Gauge,
  MapPin,
  Radar,
  ShieldCheck,
  Siren,
  Timer,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { SeverityBadge } from '../components/ui/Badges';
import { formatWaiting } from '../lib/severity';
import type { PublicSummary } from '../lib/types';
import { api } from '../lib/api';
import { useHealth } from '../lib/usePolledResource';

const HERO_STEPS = [
  {
    icon: Siren,
    title: 'Register',
    text: 'Patient details, location, severity, blood group and medicine are captured with validation on every field.',
  },
  {
    icon: Gauge,
    title: 'Rank',
    text: 'A priority queue orders CRITICAL, HIGH, MEDIUM and LOW, breaking ties by waiting time.',
  },
  {
    icon: Radar,
    title: 'Locate',
    text: 'The Haversine formula finds the nearest AVAILABLE ambulance; busy and offline vehicles are skipped.',
  },
  {
    icon: Building2,
    title: 'Match',
    text: 'Hospitals with a free bed are scored out of 100 on blood, medicine and nearness.',
  },
  {
    icon: CheckCircle2,
    title: 'Assign',
    text: 'One transaction reserves the ambulance and the bed, writes the assignment and states the reason.',
  },
];

const FEATURES = [
  {
    icon: Gauge,
    title: 'Severity-first ranking',
    text: 'CRITICAL 4, HIGH 3, MEDIUM 2, LOW 1. Equal severity is settled by who has waited longest, so no critical patient queues behind a minor case.',
  },
  {
    icon: Ambulance,
    title: 'Nearest free ambulance',
    text: 'Straight-line distance from stored coordinates, computed with the Haversine formula over AVAILABLE ambulances only.',
  },
  {
    icon: BedDouble,
    title: 'Readiness, not just a bed',
    text: 'A free bed is the entry condition. Blood group and medicine stock then decide which of the ready hospitals wins.',
  },
  {
    icon: ShieldCheck,
    title: 'No double booking',
    text: 'Ambulance and bed reservation happen inside a single database transaction with row locking, so two simultaneous calls cannot take the same resource.',
  },
  {
    icon: Droplets,
    title: 'Hospital-maintained stock',
    text: 'Emergency staff keep beds, blood units and critical medicine current; the next match uses the new values immediately.',
  },
  {
    icon: Clock3,
    title: 'Reason for every dispatch',
    text: 'Severity, distance, readiness score and which requirements were met - shown on every assignment, not just a final choice.',
  },
];

const READINESS_ROWS = [
  { label: 'Required blood group in stock', points: 40, width: '40%' },
  { label: 'Required medicine in stock', points: 40, width: '40%' },
  { label: 'Nearness to the emergency', points: 20, width: '20%' },
];

export function LandingPage() {
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const { data: health } = useHealth(20000);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await api.get<PublicSummary>('/public/summary');
        if (active) setSummary(response.data);
      } catch {
        /* the hero panel shows an offline note instead */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Brand />
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-600 md:flex">
            <a href="#how-it-works" className="transition hover:text-brand-600">
              How it works
            </a>
            <a href="#ranking" className="transition hover:text-brand-600">
              Ranking
            </a>
            <a href="#capabilities" className="transition hover:text-brand-600">
              Capabilities
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login?role=patient"
              className="btn-ghost hidden sm:inline-flex"
            >
              Patient portal
            </Link>
            <Link to="/login" className="btn-ghost hidden md:inline-flex">
              Staff sign in
            </Link>
            <Link to="/login?role=dispatcher" className="btn-primary !px-4 !py-2">
              Open console
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute inset-0 grid-lines opacity-60" aria-hidden="true" />
        <div
          className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-brand-600/25 blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="absolute -right-20 -top-16 h-72 w-72 rounded-full bg-critical/20 blur-[100px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-20 lg:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-critical" />
              Search &amp; Ranking System
            </span>
            <h1 className="mt-5 text-balance text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[46px]">
              The first hour decides everything.
              <span className="block text-brand-300">Make it count.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-white/70">
              GoldenHour ranks every emergency call by medical severity, sends the
              nearest available ambulance and matches the patient to the hospital that
              is actually ready - with a stated reason for every decision.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/login?role=dispatcher" className="btn-primary !bg-white !text-navy-900 hover:!bg-white/90">
                <Siren size={16} />
                Dispatcher sign in
              </Link>
              <Link
                to="/login?role=hospital"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Building2 size={16} />
                Hospital staff sign in
              </Link>
              <Link
                to="/login?role=patient"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <HeartPulse size={16} />
                Patient portal
              </Link>
            </div>
            <dl className="mt-9 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                { value: '4', label: 'severity classes' },
                { value: '100', label: 'readiness points' },
                { value: '8', label: 'core tables' },
                { value: '20', label: 'acceptance tests' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[22px] font-bold text-white">{item.value}</dt>
                  <dd className="text-[11px] uppercase tracking-[0.1em] text-white/45">
                    {item.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-fade-up lg:animate-none">
            <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-2 shadow-lift backdrop-blur">
              <div className="rounded-xl bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-critical">
                      <HeartPulse size={16} />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-ink-900">
                        Live priority queue
                      </p>
                      <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                        top of stack
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      health
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      {health ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                      ) : null}
                      <span
                        className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                          health ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      />
                    </span>
                    {health ? 'API online' : 'waiting for API'}
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {!summary || summary.queue.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-[12px] text-ink-500">
                      {summary
                        ? 'No open emergency calls right now. The queue fills as dispatchers raise calls.'
                        : 'Live queue unavailable - the API on port 4000 is not reachable.'}
                    </li>
                  ) : (
                    summary.queue.map((item, index) => (
                      <li
                        key={item.requestId}
                        className={`rounded-xl border border-ink-200/70 bg-white px-3 py-2.5 ${
                          index === 0 ? 'shadow-sm' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink-500">
                              #{index + 1}
                            </span>
                            <span className="truncate text-[12.5px] font-semibold text-ink-900">
                              {item.area}
                            </span>
                          </span>
                          <SeverityBadge severity={item.severity} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-500">
                          <span className="flex items-center gap-1">
                            <Timer size={11} /> {formatWaiting(item.waitingMinutes)}
                          </span>
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={11} />
                            <span className="truncate">{item.requestId}</span>
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>

                <p className="mt-3 flex items-center gap-1.5 border-t border-ink-200/70 pt-3 text-[10.5px] text-ink-400">
                  <Radar size={12} />
                  Served from PostgreSQL by GET /api/public/summary - anonymised, no patient identity.
                </p>
              </div>
            </div>
            <p className="mt-3 px-1 text-[11px] text-white/40">
              Figures for the Hubballi, Karnataka area. Simulation only.
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-14">
        <div className="max-w-2xl">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-600">
            How GoldenHour works
          </p>
          <h2 className="mt-2 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
            Five decisions, one continuous flow
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
            Every step below is a working backend operation, not a screen-only
            mock-up: validation, ranking, distance search, readiness scoring and a
            transactional assignment.
          </p>
        </div>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HERO_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="card relative p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="absolute right-3 top-3 text-[11px] font-bold text-ink-300">
                  0{index + 1}
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={18} />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold text-ink-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  {step.text}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="ranking" className="border-y border-ink-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-600">
              Ranking model
            </p>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
              Severity first. Waiting time second.
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-500">
              The queue is a priority queue keyed on severity weight and then on{' '}
              <span className="font-semibold text-ink-700">created_at ascending</span>.
              It is recalculated whenever a request arrives or a case closes, so the top
              of the list is always the patient who should be served next.
            </p>
            <div className="mt-6 space-y-2.5">
              {([
                ['CRITICAL', 4, 'Immediate threat to life', 'bg-critical'],
                ['HIGH', 3, 'Serious, urgent response', 'bg-high'],
                ['MEDIUM', 2, 'Stable, needs an ambulance promptly', 'bg-medium'],
                ['LOW', 1, 'Non-urgent, served last', 'bg-stable'],
              ] as const).map(([label, weight, text, color]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-ink-200/70 bg-canvas/60 px-3 py-2.5"
                >
                  <span className={`h-8 w-1.5 rounded-full ${color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink-900">
                      {label}
                      <span className="ml-2 font-medium text-ink-400">{text}</span>
                    </p>
                  </div>
                  <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-ink-600 shadow-sm">
                    wt {weight}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold text-ink-900">
                  Hospital readiness score
                </h3>
                <p className="mt-1 text-[12.5px] text-ink-500">
                  Out of 100. A hospital with no free bed is never scored.
                </p>
              </div>
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border-[5px] border-brand-100">
                <span className="text-[13px] font-bold text-brand-700">/100</span>
              </span>
            </div>

            <ul className="mt-5 space-y-4">
              {READINESS_ROWS.map((row) => (
                <li key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12.5px] font-medium text-ink-700">{row.label}</p>
                    <p className="text-[12px] font-bold tabular-nums text-ink-900">
                      {row.points}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: row.width }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl bg-ink-100/70 px-3.5 py-3 text-[12px] leading-relaxed text-ink-600">
              <span className="font-semibold text-ink-800">Weights:</span>{' '}
              blood 40, medicine 40, nearness 20. If no blood group or medicine is
              required, that component is awarded in full. Nearness uses the approved
              linear decay, 20 × max(0, 1 − d / 25), implemented in the readiness service.
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-6xl px-5 py-14">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-600">
          Capabilities
        </p>
        <h2 className="mt-2 max-w-2xl text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
          Built around four core functions
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-800 text-white">
                    <Icon size={18} />
                  </span>
                </div>
                <h3 className="mt-3.5 text-[14.5px] font-semibold text-ink-900">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
                  {feature.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card overflow-hidden">
            <div className="h-1.5 w-full bg-brand-600" />
            <div className="p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Siren size={20} />
              </span>
              <h3 className="mt-3.5 text-[17px] font-semibold text-ink-900">
                Dispatcher console
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
                Register emergencies, watch the ranked queue, compare ambulance
                distance and hospital readiness, then confirm or close a case.
              </p>
              <Link to="/login?role=dispatcher" className="btn-primary mt-4">
                Enter dispatcher console <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="h-1.5 w-full bg-stable" />
            <div className="p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-stable">
                <Building2 size={20} />
              </span>
              <h3 className="mt-3.5 text-[17px] font-semibold text-ink-900">
                Hospital console
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
                See patients on the way, the assigned ambulance and its distance, and
                keep beds, blood units and medicine stock current for the next match.
              </p>
              <Link to="/login?role=hospital" className="btn-secondary mt-4">
                Enter hospital console <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-9 md:grid-cols-[1.4fr_1fr]">
          <div>
            <Brand />
            <p className="mt-3 max-w-lg text-[12px] leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-700">
                Simulation.
              </span>{' '}
              GoldenHour is not connected to 108 or any live emergency service.
            </p>
          </div>
          <div className="text-[12px] text-ink-500 md:text-right">
            <p className="flex items-center gap-1.5 md:justify-end">
              <Activity size={13} /> GoldenHour v0.14 - patient portal
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-5">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-critical">
          <Siren size={22} />
        </span>
        <h1 className="mt-4 text-[20px] font-bold text-ink-900">Page not found</h1>
        <p className="mt-1.5 text-[13px] text-ink-500">
          This route is either not built yet or the address is incorrect.
        </p>
        <Link to="/" className="btn-primary mt-5">
          Back to GoldenHour <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
