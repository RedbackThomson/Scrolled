import { useId } from 'react';

export interface LogoProps {
  size?: number;
  /** Show "Scrolled" next to the mark */
  wordmark?: boolean;
  /** Dataset / server name under the wordmark */
  subtitle?: string;
  shadow?: boolean;
}

export function Logo({ size = 34, wordmark = true, subtitle, shadow }: LogoProps) {
  const id = useId().replace(/:/g, '');
  const mark = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        flex: 'none',
        display: 'block',
        filter: shadow ? 'drop-shadow(0 6px 10px rgba(40,90,160,.25))' : undefined,
      }}
      aria-label="Scrolled"
    >
      <defs>
        <linearGradient id={id + 's'} x1="0" y1="0" x2=".6" y2="1">
          <stop offset="0" stopColor="#8dc6ef" />
          <stop offset="1" stopColor="#3f86cf" />
        </linearGradient>
        <linearGradient id={id + 'p'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#f3e3bf" />
        </linearGradient>
        <linearGradient id={id + 'g'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7a8" />
          <stop offset="1" stopColor="#e3ad4c" />
        </linearGradient>
        <clipPath id={id + 'c'}>
          <rect width="100" height="100" rx="30" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="100" height="100" fill={`url(#${id}s)`} />
        <rect y="94" width="100" height="6" opacity=".16" />
        <rect width="100" height="3" fill="#fff" opacity=".4" />
        <rect x="20" y="28" width="60" height="62" rx="8" fill={`url(#${id}p)`} />
        <rect x="10" y="16" width="80" height="17" rx="8.5" fill={`url(#${id}g)`} />
        <ellipse cx="38" cy="53" rx="5" ry="6" fill="#23305a" />
        <ellipse cx="62" cy="53" rx="5" ry="6" fill="#23305a" />
        <circle cx="36.6" cy="50.6" r="1.8" fill="#fff" />
        <circle cx="60.6" cy="50.6" r="1.8" fill="#fff" />
        <ellipse cx="30.5" cy="65" rx="5.5" ry="3" fill="#f0a3a8" opacity=".65" />
        <ellipse cx="69.5" cy="65" rx="5.5" ry="3" fill="#f0a3a8" opacity=".65" />
        <path d="M44 63h12a6 6 0 0 1-12 0z" fill="#23305a" />
      </g>
    </svg>
  );
  if (!wordmark) return mark;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.3 }}>
      {mark}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span
          style={{
            font: `600 ${Math.round(size * 0.56)}px var(--font-display)`,
            color: 'var(--text-1)',
          }}
        >
          Scrolled
        </span>
        {subtitle && (
          <span style={{ font: 'var(--type-meta)', color: 'var(--text-2)' }}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}
