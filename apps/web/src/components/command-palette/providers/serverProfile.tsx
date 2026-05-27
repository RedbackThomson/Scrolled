import { Gamepad2 } from 'lucide-react';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { useCommandPalette } from '@/lib/useCommandPalette';
import { useServerProfile, useSetServerProfile } from '@/lib/useServerProfile';
import { BUILTIN_PROFILES } from '@/serverProfiles';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

export function ServerProfileProvider() {
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const sp = useServerProfile();
  const setM = useSetServerProfile();

  const items = BUILTIN_PROFILES.filter((p) => fuzzy(query, `server profile ${p.name} ${p.id}`));
  if (items.length === 0) return null;

  return (
    <CommandGroup heading="Server profile">
      {items.map((p) => {
        const active = p.id === sp.profile.id;
        return (
          <CommandItemPrimitive
            key={p.id}
            value={`profile-${p.id}`}
            keywords={['server', 'profile', 'rates', p.name, p.id]}
            onSelect={() => {
              setM.mutate(p.id);
              setOpen(false);
            }}
          >
            <Gamepad2 className="text-muted-foreground h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">Server profile: {p.name}</span>
            {active && <span className="text-muted-foreground shrink-0 text-xs">Active</span>}
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
