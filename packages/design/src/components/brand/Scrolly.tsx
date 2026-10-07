import { useId } from 'react';

export type ScrollyPose = 'idle' | 'wave' | 'read' | 'sleepy' | 'cheer';

export interface ScrollyProps {
  size?: number;
  /** idle (default), wave (welcome / 404), read (loading), sleepy (empty / offline), cheer (setup done) */
  pose?: ScrollyPose;
  /** Bob + blink; tie to the Interface motion setting */
  animate?: boolean;
}

export function Scrolly({ size = 100, pose = 'idle', animate = true }: ScrollyProps) {
  const id = useId().replace(/:/g, '');
  const g = (k: string) => `url(#${id}${k})`;
  const anim = animate
    ? pose === 'cheer'
      ? 'sc-hop .8s var(--ease-hop) infinite'
      : 'sc-bob 2.6s ease-in-out infinite'
    : 'none';
  const closed = pose === 'sleepy';
  const eye = (cx: number) =>
    closed ? (
      <rect x={cx - 4.5} y="40" width="9" height="2.5" rx="1.25" fill="#23305a" />
    ) : (
      <g
        style={{
          animation: animate ? 'sc-blink 4.2s infinite' : 'none',
          transformOrigin: `${cx}px 41px`,
        }}
      >
        <ellipse cx={cx} cy="41" rx="4" ry="5" fill="#23305a" />
        <circle cx={cx - 1.2} cy="38.8" r="1.4" fill="#fff" />
      </g>
    );
  const armR =
    pose === 'wave' ? (
      <rect
        x="80"
        y="48"
        width="20"
        height="8"
        rx="4"
        fill="#f6ead0"
        transform="rotate(-50 80 52)"
        style={{
          animation: animate ? 'sc-wave .9s ease-in-out infinite' : 'none',
          transformOrigin: '80px 52px',
          transformBox: 'view-box',
        }}
      />
    ) : pose === 'cheer' ? (
      <rect
        x="78"
        y="50"
        width="18"
        height="7.5"
        rx="3.75"
        fill="#f6ead0"
        transform="rotate(-50 78 53.75)"
      />
    ) : (
      <rect
        x="78"
        y="50"
        width="18"
        height="7.5"
        rx="3.75"
        fill="#f6ead0"
        transform="rotate(20 78 53.75)"
      />
    );
  const armL =
    pose === 'cheer' ? (
      <rect
        x="4"
        y="50"
        width="18"
        height="7.5"
        rx="3.75"
        fill="#f6ead0"
        transform="rotate(50 22 53.75)"
      />
    ) : (
      <rect
        x="4"
        y="50"
        width="18"
        height="7.5"
        rx="3.75"
        fill="#f6ead0"
        transform="rotate(-20 22 53.75)"
      />
    );
  return (
    <svg
      viewBox="0 0 100 122"
      width={size}
      height={size * 1.22}
      style={{ overflow: 'visible', display: 'block' }}
      aria-label={`Scrolly, ${pose}`}
    >
      <defs>
        <linearGradient id={id + 'p'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#f3e3bf" />
        </linearGradient>
        <linearGradient id={id + 'g'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7a8" />
          <stop offset="1" stopColor="#e3ad4c" />
        </linearGradient>
        <radialGradient id={id + 'c'} cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor="#f0c46a" />
          <stop offset="1" stopColor="#b9802a" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="113" rx="28" ry="3.5" fill="#142a5a" opacity=".14" />
      <g style={{ animation: anim, transformOrigin: '50px 100px' }}>
        {armL}
        <rect x="18" y="16" width="64" height="66" rx="7" fill={g('p')} />
        {armR}
        <rect x="10" y="7" width="80" height="16" rx="8" fill={g('g')} />
        <circle cx="10" cy="15" r="6.5" fill={g('c')} />
        <circle cx="90" cy="15" r="6.5" fill={g('c')} />
        <rect x="10" y="78" width="80" height="16" rx="8" fill={g('g')} />
        <circle cx="10" cy="86" r="6.5" fill={g('c')} />
        <circle cx="90" cy="86" r="6.5" fill={g('c')} />
        {eye(37)}
        {eye(61)}
        <ellipse cx="30.5" cy="52" rx="5.5" ry="3" fill="#f0a3a8" opacity=".6" />
        <ellipse cx="67.5" cy="52" rx="5.5" ry="3" fill="#f0a3a8" opacity=".6" />
        {pose === 'cheer' ? (
          <path d="M44 48h12v2a6 6 0 0 1-12 0z" fill="#23305a" />
        ) : (
          <path d="M44.5 49h11a5.5 5.5 0 0 1-11 0z" fill="#23305a" />
        )}
        {pose === 'read' && (
          <rect x="30" y="56" width="40" height="24" rx="3" fill="oklch(0.6 0.14 245)" />
        )}
        {pose === 'sleepy' && (
          <text
            x="86"
            y="2"
            fontFamily="Fredoka, sans-serif"
            fontWeight="700"
            fontSize="16"
            fill="oklch(0.6 0.12 245)"
          >
            z
          </text>
        )}
      </g>
    </svg>
  );
}
