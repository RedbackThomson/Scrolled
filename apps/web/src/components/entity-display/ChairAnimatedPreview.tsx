import { useEffect, useState } from 'react';
import { bytesToUrl } from '@/lib/blob';
import { cn } from '@/lib/utils';

interface Props {
  data: Uint8Array;
  width: number;
  height: number;
  alt: string;
  className?: string;
}

/**
 * Renders the chair's pre-rendered animated PNG (APNG). Browsers play APNG
 * natively inside `<img>` — no canvas loop here, the heavy lifting is done
 * once at extraction time.
 */
export function ChairAnimatedPreview({ data, width, height, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const next = bytesToUrl(data, 'image/apng');
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [data]);

  if (!url) return null;
  return (
    <img
      src={url}
      width={width}
      height={height}
      alt={alt}
      // Native dimensions can be wider than the page — cap the rendered size
      // and let the browser scale; `h-auto` keeps the aspect ratio.
      className={cn(
        'border-border bg-muted/30 inline-block max-h-64 max-w-full rounded border object-contain',
        className,
      )}
    />
  );
}
