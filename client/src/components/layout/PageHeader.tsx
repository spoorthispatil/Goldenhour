import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[20px] font-bold tracking-tight text-ink-900 sm:text-[22px]">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] text-ink-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
