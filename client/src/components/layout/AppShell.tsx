import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({
  title,
  subtitle,
  onRefresh,
  children,
}: {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-[268px]">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenu={() => setNavOpen(true)}
          onRefresh={onRefresh}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-8 text-[11.5px] text-ink-400 sm:px-6 xl:px-8">
          GoldenHour - simulation project. Not a live emergency dispatch
          service.
        </footer>
      </div>
    </div>
  );
}
