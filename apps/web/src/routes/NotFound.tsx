import { Link } from 'react-router-dom';
import { EmptyState } from '@scrolled/design';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="pt-10">
      <EmptyState
        mascot="wave"
        title="Page not found"
        body="The page you were looking for doesn't exist."
        actions={
          <Link
            to="/"
            className="text-primary-foreground ease-spring inline-flex h-9 items-center rounded-md bg-[image:var(--gradient-accent)] px-3.5 text-[13px] font-bold shadow-[var(--shadow-btn)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            ← Back home
          </Link>
        }
      />
    </div>
  );
}
