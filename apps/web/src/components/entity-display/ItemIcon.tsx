import { useState } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { useIcon, type IconRef } from '@/hooks/useIcon';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const log = createLogger('icon-img');

interface Props {
  entity: 'item' | 'equip';
  id: number;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders a DB-persisted icon for an item or equip. Falls back to a
 * neutral placeholder while loading or when no icon bytes are stored.
 */
export function ItemIcon({ entity, id, size = 32, className, alt }: Props) {
  const ref: IconRef = { entity, id };
  const url = useIcon(ref);
  const [imgError, setImgError] = useState(false);
  const dim = `${size}px`;

  if (!url) {
    return (
      <span
        className={cn(
          'bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded',
          className,
        )}
        style={{ width: dim, height: dim }}
        aria-hidden={!alt}
        aria-label={alt}
        title={`no icon · ${entity} ${id}`}
      >
        <Package className="h-1/2 w-1/2 opacity-60" />
      </span>
    );
  }

  if (imgError) {
    return (
      <span
        className={cn(
          'bg-destructive/15 text-destructive inline-flex shrink-0 items-center justify-center rounded',
          className,
        )}
        style={{ width: dim, height: dim }}
        title={`<img> load failed · ${entity} ${id}`}
      >
        <AlertTriangle className="h-1/2 w-1/2" />
      </span>
    );
  }

  return (
    <img
      src={url}
      width={size}
      height={size}
      alt={alt ?? ''}
      // `object-contain` preserves aspect ratio inside the square box; without
      // it equip sprites — which aren't square — get stretched horizontally to
      // fill the 28×28 cell. The `width`/`height` attributes still drive the
      // CSS box dimensions; `object-fit` just controls how the bitmap fills it.
      className={cn('inline-block shrink-0 rounded object-contain', className)}
      style={{ width: dim, height: dim }}
      onError={(e) => {
        log.warn('img onError', { entity, id, event: e.type });
        setImgError(true);
      }}
    />
  );
}
