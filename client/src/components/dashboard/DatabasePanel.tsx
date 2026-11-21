import { Database, KeyRound, Layers, ShieldCheck, Table2 } from 'lucide-react';
import { Card, CardHeader, ErrorState, LoadingBlock } from '../ui/Card';
import { usePolledResource } from '../../lib/usePolledResource';
import type { DatabaseOverview } from '../../lib/types';

export function DatabasePanel() {
  const { data, error, loading, refresh } =
    usePolledResource<DatabaseOverview>('/database/overview', 15000);

  return (
    <Card>
      <CardHeader
        title="PostgreSQL data layer"
        subtitle="Live row counts from the core tables - no fixtures, no cached JSON"
        icon={Database}
        action={
          data ? (
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              connected
            </span>
          ) : null
        }
      />

      {loading && !data ? <LoadingBlock label="Reading schema from PostgreSQL" /> : null}
      {error && !data ? <ErrorState message={error} onRetry={refresh} /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-4">
            {data.tables.map((table) => (
              <div
                key={table.name}
                className="rounded-xl border border-ink-200/70 bg-white px-3 py-2.5"
              >
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                  <Table2 size={11} className="text-ink-400" />
                  {table.label}
                </p>
                <p className="mt-1.5 text-[19px] font-bold leading-none tabular-nums text-ink-900">
                  {table.rows}
                </p>
                <p className="mt-1 font-mono text-[10px] text-ink-400">{table.name}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-ink-200/60 px-5 py-4 text-[12px] sm:grid-cols-4">
            <div>
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                <Database size={11} /> Server
              </p>
              <p className="mt-1 font-semibold text-ink-800">{data.serverVersion}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Database
              </p>
              <p className="mt-1 font-semibold text-ink-800">
                {data.databaseName} - {data.sizePretty}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                <Layers size={11} /> Migrations
              </p>
              <p className="mt-1 font-semibold text-ink-800">
                {data.migrationCount} applied
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                <ShieldCheck size={11} /> Guards
              </p>
              <p className="mt-1 font-semibold text-ink-800">
                {data.constraintCount} constraints, {data.indexCount} indexes
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 border-t border-ink-200/60 px-5 py-3 text-[11.5px] text-ink-500">
            <KeyRound size={13} className="mt-0.5 shrink-0 text-ink-400" />
            CHECK constraints reject invalid contacts, ages, bed counts and stock; a
            partial unique index on <span className="font-mono">assignment</span> makes
            double booking impossible at the database level.
          </div>
        </>
      ) : null}
    </Card>
  );
}
