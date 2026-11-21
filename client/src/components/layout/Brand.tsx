import { Link } from 'react-router-dom';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative grid place-items-center rounded-[14px] bg-navy-800 shadow-inner ${className}`}
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <path
          d="M13.4 5h5.2v5.4H24v5.2h-5.4V21h-5.2v-5.4H8v-5.2h5.4z"
          fill="#DC2626"
        />
        <path
          d="M5 26h5.5l2.3-4.2 2.9 6.4 2.6-5.6 1.9 3.4H27"
          fill="none"
          stroke="#93B4FF"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Brand({
  subtitle = 'Emergency Response Network',
  inverted = false,
}: {
  subtitle?: string;
  inverted?: boolean;
}) {
  return (
    <Link to="/" className="group flex items-center gap-3">
      <BrandMark className="h-10 w-10" />
      <span className="leading-tight">
        <span
          className={`block text-[16px] font-bold tracking-tight ${
            inverted ? 'text-white' : 'text-ink-900'
          }`}
        >
          Golden<span className="text-critical">Hour</span>
        </span>
        <span
          className={`block text-[10.5px] font-medium uppercase tracking-[0.14em] ${
            inverted ? 'text-white/50' : 'text-ink-400'
          }`}
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
