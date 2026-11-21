import type { LucideIcon } from 'lucide-react';

type Tone = 'brand' | 'critical' | 'warning' | 'success' | 'neutral';

const TONE_STYLES: Record<Tone, { ring: string; icon: string; value: string }> = {
  brand: {
    ring: 'bg-brand-50 text-brand-600',
    icon: '',
    value: 'text-ink-900',
  },
  critical: { ring: 'bg-red-50 text-critical', icon: '', value: 'text-critical' },
  warning: { ring: 'bg-amber-50 text-amber-600', icon: '', value: 'text-ink-900' },
  success: { ring: 'bg-emerald-50 text-stable', icon: '', value: 'text-ink-900' },
  neutral: { ring: 'bg-ink-100 text-ink-500', icon: '', value: 'text-ink-900' },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="card group relative overflow-hidden p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {label}
        </p>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${styles.ring}`}
        >
          <Icon size={17} />
        </span>
      </div>
      <p className={`mt-3 text-[28px] font-bold leading-none ${styles.value}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12px] text-ink-500">{hint}</p> : null}
    </div>
  );
}
