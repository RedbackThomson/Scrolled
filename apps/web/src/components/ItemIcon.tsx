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
          'bg-muted text-muted-foreground inline-flex items-center justify-center rounded',
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
          'bg-destructive/15 text-destructive inline-flex items-center justify-center rounded',
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
      className={cn('inline-block rounded', className)}
      style={{ width: dim, height: dim }}
      onError={(e) => {
        log.warn('img onError', { entity, id, event: e.type });
        setImgError(true);
      }}
    />
  );
}
