import { Fragment, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../core/Button';

export interface PaginationProps {
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (page: number) => void;
  /** Shown beside the range text, e.g. a rows-per-page select */
  pageSizeControl?: ReactNode;
}

export function Pagination({
  page = 1,
  pageSize = 25,
  total = 0,
  onPage,
  pageSizeControl,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const list = [
    ...new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages)),
  ].sort((a, b) => a - b);
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        font: 'var(--type-body)',
        fontSize: 13,
        color: 'var(--text-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {total ? `Showing ${start}–${end} of ${total.toLocaleString()}` : 'No results'}
        </span>
        {pageSizeControl}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          disabled={page <= 1}
          onClick={() => onPage?.(page - 1)}
        >
          Prev
        </Button>
        {list.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && p - list[i - 1] > 1 && (
              <span style={{ width: 20, textAlign: 'center' }}>…</span>
            )}
            <button
              type="button"
              className="sc-focus-ring"
              onClick={() => onPage?.(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              style={{
                minWidth: 30,
                height: 30,
                padding: '0 6px',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                font: `${p === page ? 700 : 600} 13px var(--font-body)`,
                background: p === page ? 'var(--gradient-accent)' : 'transparent',
                color: p === page ? 'var(--accent-fg)' : 'var(--text-1)',
                boxShadow: p === page ? 'var(--shadow-btn)' : 'none',
              }}
            >
              {p}
            </button>
          </Fragment>
        ))}
        <Button
          variant="secondary"
          size="sm"
          iconRight={ChevronRight}
          disabled={page >= pages}
          onClick={() => onPage?.(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
