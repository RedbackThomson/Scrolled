import { useState } from 'react';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { useIcon, type IconRef } from '@/hooks/useIcon';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const log = createLogger('entity-icon');

interface Props {
  entity: IconRef['entity'];
  id: number;
  /** Square dimension in px. Default 32. Ignored when `width`/`height` are set. */
  size?: number;
  /** Override the placeholder glyph (e.g. Skull for mobs, Users for NPCs). */
  placeholder?: LucideIcon;
  className?: string;
  alt?: string;
  /**
   * For minimaps the natural size isn't square. Pass `{ maxWidth, maxHeight }`
   * to render with object-fit: contain inside a flexible box instead.
   */
  fit?: { maxWidth: number; maxHeight: number };
}

/**
 * Renders a DB-persisted sprite for one of the supported entity types.
 * Falls back to a neutral placeholder while bytes are loading and to a
 * caller-provided glyph (or a generic warning icon) when no icon is
 * stored — that way each entity type can have its own visual identity
 * even when its image isn't in the dump.
 */
export function EntityIcon({
  entity,
  id,
  size = 32,
  placeholder: Placeholder,
  className,
  alt,
  fit,
}: Props) {
  const url = useIcon({ entity, id });
  const [imgError, setImgError] = useState(false);
  const dim = `${size}px`;
  const boxStyle = fit
    ? { maxWidth: `${fit.maxWidth}px`, maxHeight: `${fit.maxHeight}px` }
    : { width: dim, height: dim };

  if (!url) {
    return (
      <span
        className={cn(
          'bg-muted text-muted-foreground inline-flex items-center justify-center rounded',
          className,
        )}
        style={boxStyle}
        aria-hidden={!alt}
        aria-label={alt}
        title={`no icon · ${entity} ${id}`}
      >
        {Placeholder && <Placeholder className="h-1/2 w-1/2 opacity-60" />}
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
        style={boxStyle}
        title={`<img> load failed · ${entity} ${id}`}
      >
        <AlertTriangle className="h-1/2 w-1/2" />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt ?? ''}
      className={cn('inline-block rounded object-contain', fit ? 'h-auto w-auto' : '', className)}
      style={boxStyle}
      onError={(e) => {
        log.warn('img onError', { entity, id, event: e.type });
        setImgError(true);
      }}
    />
  );
}
