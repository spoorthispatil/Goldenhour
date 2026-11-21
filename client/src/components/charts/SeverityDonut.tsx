import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Severity } from '../../lib/types';
import { SEVERITY_STYLE, SEVERITY_WEIGHT } from '../../lib/severity';

interface Slice {
  severity: Severity;
  count: number;
  weight: number;
}

export function SeverityDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[190px] w-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="severity"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((slice) => (
                <Cell key={slice.severity} fill={SEVERITY_STYLE[slice.severity].hex} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                fontSize: 12,
                boxShadow: '0 12px 32px -16px rgba(16,28,44,0.3)',
              }}
              formatter={(value, name) => [`${value} requests`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold leading-none text-ink-900">{total}</span>
          <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
            open cases
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {data.map((slice) => {
          const style = SEVERITY_STYLE[slice.severity];
          const share = total === 0 ? 0 : Math.round((slice.count / total) * 100);
          return (
            <li key={slice.severity} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: style.hex }}
              />
              <span className="flex-1 text-[12.5px] font-medium text-ink-700">
                {style.label}
              </span>
              <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-500">
                wt {SEVERITY_WEIGHT[slice.severity]}
              </span>
              <span className="w-9 text-right text-[12.5px] font-semibold tabular-nums text-ink-900">
                {slice.count}
              </span>
              <span className="w-9 text-right text-[11.5px] tabular-nums text-ink-400">
                {share}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
