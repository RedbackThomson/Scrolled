import { useState, type ReactNode } from 'react';
import { Check, CloudOff, Copy, RefreshCw } from 'lucide-react';
import { Button } from '../core/Button';
import { Icon } from '../core/Icon';

export interface ErrorStateProps {
  title: string;
  body?: ReactNode;
  /** The raw error, shown in a code box and copied by "Copy details". */
  details?: string;
  onRetry?: () => void;
}

/** A calm, fixable failure: what happened, the raw error, a retry, and details to copy for a bug report. */
export function ErrorState({ title, body, details, onRetry }: ErrorStateProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!details) return;
    void navigator.clipboard?.writeText(details).then(() => setCopied(true));
  };
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
        maxWidth: 420,
        margin: '0 auto',
        padding: '24px 0',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          display: 'grid',
          placeItems: 'center',
          background: 'oklch(0.7 0.18 25 / .16)',
          color: 'oklch(0.6 0.2 25)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.06)',
        }}
      >
        <Icon icon={CloudOff} size={28} />
      </div>
      <span style={{ font: '600 20px var(--font-display)' }}>{title}</span>
      {body && (
        <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{body}</span>
      )}
      {details && (
        <code
          style={{
            maxWidth: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--surface-sunken)',
            font: '11.5px var(--font-mono)',
            color: 'var(--text-2)',
            textAlign: 'left',
            overflowWrap: 'anywhere',
          }}
        >
          {details}
        </code>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onRetry && (
          <Button icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )}
        {details && (
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? 'Copied' : 'Copy details'}
          </Button>
        )}
      </div>
    </div>
  );
}
