import { useEffect } from 'react';
import { useCommandPalette } from '@/lib/useCommandPalette';
import type { CommandItem, PalettePageContext } from './types';

interface RegistrationInput extends PalettePageContext {
  items: CommandItem[];
}

/**
 * Detail pages and listings call this to advertise themselves to the palette:
 * sets the active page context (entity + id + name) and contributes the
 * page-specific commands that render in the pinned "On this page" group.
 *
 * Caller is responsible for memoizing `items` — every identity change
 * re-registers.
 */
export function usePaletteRegistration({ entity, id, name, items }: RegistrationInput) {
  const setPageContext = useCommandPalette((s) => s.setPageContext);
  const setContextItems = useCommandPalette((s) => s.setContextItems);

  useEffect(() => {
    setPageContext({ entity, id, name });
    setContextItems(items);
    return () => {
      setPageContext(null);
      setContextItems([]);
    };
  }, [entity, id, name, items, setPageContext, setContextItems]);
}
