import { ExternalLink } from 'lucide-react';
import { Logo } from '@scrolled/design';

const AUTHOR_URL = 'https://github.com/RedbackThomson';
const SOURCE_URL = 'https://github.com/RedbackThomson/scrolled';

/** Author mark, so people on any instance can find the project and who made it. */
export function Attribution() {
  return (
    <footer className="border-border text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t-2 pt-5 text-[12.5px]">
      <Logo size={22} wordmark={false} />
      <p className="min-w-0 flex-1">
        Scrolled is free, open-source software built by{' '}
        <a
          href={AUTHOR_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground font-semibold hover:underline"
        >
          Redback
        </a>
        .
      </p>
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="text-foreground inline-flex items-center gap-1 font-semibold hover:underline"
      >
        Source code
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </footer>
  );
}
