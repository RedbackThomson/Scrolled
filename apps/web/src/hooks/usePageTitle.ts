import { useEffect } from 'react';

const APP_NAME = 'Scrolled';

/**
 * Drives the document `<title>` per page: `${title} - Scrolled`, falling back to
 * the bare app name when no title is given (e.g. the home page) or while a
 * detail page is still loading its entity. Restores the bare name on unmount.
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} - ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
