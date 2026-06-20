import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The page you were looking for doesn't exist.
      </p>
      <Link to="/" className="text-primary mt-4 inline-block text-sm hover:underline">
        ← Back home
      </Link>
    </div>
  );
}
