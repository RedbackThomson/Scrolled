import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useDomet, type LinkProps, type RegisterProps } from 'domet';
import { getSettingsNavItems, sectionIdsFromNav } from '@/components/settings/settingsNavConfig';

interface SettingsScrollSpyContextValue {
  active: string | null;
  register: (id: string) => RegisterProps;
  scrollTo: (id: string) => void;
  link: (id: string) => LinkProps;
}

const SettingsScrollSpyContext = createContext<SettingsScrollSpyContextValue | null>(null);

export function SettingsScrollSpyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const sectionIds = useMemo(() => sectionIdsFromNav(getSettingsNavItems()), []);

  // No container ref — domet defaults to window scroll, which is what the
  // document-scrolling AppShell exposes.
  const { active, register, scrollTo, link } = useDomet({
    ids: sectionIds,
    tracking: { hysteresis: 120, throttle: 16 },
    scrolling: { behavior: 'smooth', lockActive: true },
  });

  useEffect(() => {
    if (location.pathname !== '/settings') return;
    const hash = location.hash.slice(1);
    if (hash && sectionIds.includes(hash)) scrollTo(hash);
  }, [location.pathname, location.hash, sectionIds, scrollTo]);

  const value = useMemo(
    () => ({ active, register, scrollTo, link }),
    [active, register, scrollTo, link],
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

/** Spread onto each settings `<section>` so domet can track it. */
export function useSettingsSection(id: string): RegisterProps {
  const { register } = useSettingsScrollSpy();
  return register(id);
}
