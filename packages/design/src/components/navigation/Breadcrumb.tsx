import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface BreadcrumbProps {
  items: { label: string; onClick?: () => void }[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        font: '600 13px var(--font-body)',
        color: 'var(--text-2)',
      }}
    >
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <Icon icon={ChevronRight} size={13} />}
          {it.onClick ? (
            <button
              type="button"
              className="sc-focus-ring"
              onClick={it.onClick}
              style={{ font: 'inherit', color: 'var(--text-2)', cursor: 'pointer' }}
            >
              {it.label}
            </button>
          ) : (
            <span
              aria-current={i === items.length - 1 ? 'page' : undefined}
              style={{ color: i === items.length - 1 ? 'var(--text-1)' : 'var(--text-2)' }}
            >
              {it.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
