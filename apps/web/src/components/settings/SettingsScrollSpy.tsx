import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { getSettingsNavItems, sectionIdsFromNav } from '@/components/settings/settingsNavConfig';

/** Spread onto each settings `<section>` so the scroll-spy can track it. */
export interface SectionProps {
  id: string;
  ref: (el: HTMLElement | null) => void;
}

/** Spread onto a nav control that jumps to a section. */
export interface SectionLinkProps {
  onClick: () => void;
  'aria-current': 'page' | undefined;
}

interface SettingsScrollSpyContextValue {
  active: string | null;
  scrollTo: (id: string) => void;
  link: (id: string) => SectionLinkProps;
  /** Internal: a section reports whether it currently crosses the trigger band. */
  reportInView: (id: string, inView: boolean) => void;
  /** Internal: a section publishes its DOM node so `scrollTo` can reach it. */
  setElement: (id: string, el: HTMLElement | null) => void;
}

const SettingsScrollSpyContext = createContext<SettingsScrollSpyContextValue | null>(null);

export function SettingsScrollSpyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const sectionIds = useMemo(() => sectionIdsFromNav(getSettingsNavItems()), []);

  const elements = useRef(new Map<string, HTMLElement>());
  const inViewIds = useRef(new Set<string>());
  const [active, setActive] = useState<string | null>(null);

  const setElement = useCallback((id: string, el: HTMLElement | null) => {
    if (el) elements.current.set(id, el);
    else elements.current.delete(id);
  }, []);

  const reportInView = useCallback(
    (id: string, inView: boolean) => {
      if (inView) inViewIds.current.add(id);
      else inViewIds.current.delete(id);
      // Active = the first section (in nav order) currently crossing the
      // trigger band. Retain the previous one when the band is empty —
      // mid-scroll between sections — so the highlight doesn't flicker off.
      const next = sectionIds.find((sid) => inViewIds.current.has(sid));
      if (next) setActive(next);
    },
    [sectionIds],
  );

  const scrollTo = useCallback((id: string) => {
    const el = elements.current.get(id) ?? document.getElementById(id);
    // `scroll-mt-20` on each section keeps it clear of the sticky header.
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const link = useCallback(
    (id: string): SectionLinkProps => ({
      onClick: () => scrollTo(id),
      'aria-current': active === id ? 'page' : undefined,
    }),
    [active, scrollTo],
  );

  useEffect(() => {
    if (location.pathname !== '/settings') return;
    const hash = location.hash.slice(1);
    if (hash && sectionIds.includes(hash)) scrollTo(hash);
  }, [location.pathname, location.hash, sectionIds, scrollTo]);

  const value = useMemo(
    () => ({ active, scrollTo, link, reportInView, setElement }),
    [active, scrollTo, link, reportInView, setElement],
  );

  return (
    <SettingsScrollSpyContext.Provider value={value}>{children}</SettingsScrollSpyContext.Provider>
  );
}

export function useSettingsScrollSpy(): SettingsScrollSpyContextValue {
  const ctx = useContext(SettingsScrollSpyContext);
  if (!ctx) {
    throw new Error('useSettingsScrollSpy must be used within SettingsScrollSpyProvider');
  }
  return ctx;
}

/**
 * Spread onto each settings `<section>` so the scroll-spy can track it. A
 * section becomes active once its top scrolls into a band near the top of the
 * viewport (the `rootMargin` below shrinks the observer root to that band,
 * offset to match the sticky header).
 */
export function useSettingsSection(id: string): SectionProps {
  const { reportInView, setElement } = useSettingsScrollSpy();
  const { ref, inView } = useInView({ rootMargin: '-80px 0px -70% 0px' });

  useEffect(() => {
    reportInView(id, inView);
  }, [id, inView, reportInView]);

  // Combine the observer's callback ref with element capture for scrollTo.
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      ref(el);
      setElement(id, el);
    },
    [id, ref, setElement],
  );

  return { id, ref: setRef };
}
