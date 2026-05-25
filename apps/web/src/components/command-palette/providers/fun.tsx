import { useMemo } from 'react';
import { Dices } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CommandGroup,
  CommandItem as CommandItemPrimitive,
} from '@/components/ui/command';
import { getDbClient, type EntityKind } from '@/db';
import {
  ENTITY_KINDS,
  labelForEntityKind,
  routeForEntity,
} from '@/lib/entityRoutes';
import { useCommandPalette } from '@/lib/useCommandPalette';
import { useFeatures } from '@/lib/useFeatures';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

export function FunProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const features = useFeatures();
  const db = useMemo(() => getDbClient(), []);

  const enabled: Record<EntityKind, boolean> = {
    item: features.hasItems,
    equip: features.hasEquips,
    mob: features.hasMobs,
    npc: features.hasNpcs,
    map: features.hasMaps,
    quest: features.hasQuests,
  };

  const entries = ENTITY_KINDS.filter((k) => enabled[k]).map((k) => ({
    kind: k,
    label: `Random ${labelForEntityKind(k)}`,
  }));

  const visible = entries.filter((e) => fuzzy(query, `${e.label} random`));
  if (visible.length === 0) return null;

  return (
    <CommandGroup heading="Explore">
      {visible.map((e) => (
        <CommandItemPrimitive
          key={`random-${e.kind}`}
          value={`random-${e.kind}`}
          keywords={['random', e.label, labelForEntityKind(e.kind, true)]}
          onSelect={async () => {
            const entries = await db.listSearchEntries();
            const pool = entries.filter((s) => s.entity === e.kind);
            if (pool.length === 0) return;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            navigate(routeForEntity(e.kind, pick.id));
            setOpen(false);
          }}
        >
          <Dices className="text-muted-foreground h-4 w-4" />
          <span>{e.label}</span>
        </CommandItemPrimitive>
      ))}
    </CommandGroup>
  );
}
