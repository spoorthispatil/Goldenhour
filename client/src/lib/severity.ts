import type { Severity } from './types';

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface SeverityStyle {
  label: string;
  hex: string;
  chip: string;
  dot: string;
  accent: string;
  description: string;
}

export const SEVERITY_STYLE: Record<Severity, SeverityStyle> = {
  CRITICAL: {
    label: 'Critical',
    hex: '#DC2626',
    chip: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-600',
    accent: 'border-l-red-600',
    description: 'Immediate threat to life - dispatch first',
  },
  HIGH: {
    label: 'High',
    hex: '#EA580C',
    chip: 'border-orange-200 bg-orange-50 text-orange-700',
    dot: 'bg-orange-500',
    accent: 'border-l-orange-500',
    description: 'Serious condition - urgent response',
  },
  MEDIUM: {
    label: 'Medium',
    hex: '#F59E0B',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-500',
    description: 'Stable but needs an ambulance promptly',
  },
  LOW: {
    label: 'Low',
    hex: '#16A34A',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-600',
    accent: 'border-l-emerald-600',
    description: 'Non-urgent - served after higher severities',
  },
};

export function formatWaiting(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
