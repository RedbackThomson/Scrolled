import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type NpcRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import type { TooltipEntityConfig, TooltipField } from './types';

interface NpcExtra {
  maps: number;
  quests: number;
}

type NpcField = TooltipField<NpcRecord, NpcExtra>;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const fields: NpcField[] = [
  {
    key: 'maps',
    label: 'Maps',
    hint: 'How many maps this NPC appears on.',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ extra }) => extra.maps > 0,
    render: ({ extra }) => <span>Appears on {plural(extra.maps, 'map', 'maps')}</span>,
  },
  {
    key: 'quests',
    label: 'Quests',
    hint: 'How many quests this NPC starts or completes.',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ extra }) => extra.quests > 0,
    render: ({ extra }) => <span>Gives {plural(extra.quests, 'quest', 'quests')}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    zone: 'body',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.description?.trim(),
    render: ({ record }) => (
      <p className="line-clamp-2 rounded-xl bg-white/[.07] px-2.5 py-2 text-[12.5px] leading-[1.45] opacity-90">
        “{record.description?.trim()}”
      </p>
    ),
  },
];

export const npcConfig: TooltipEntityConfig<NpcRecord, NpcExtra> = {
  entity: 'npc',
  idPrefix: 'NPC',
  fetch: (id) => getDbClient().getNpc(id),
  queryKey: (id) => ['db', 'npc', id],
  useExtraData: (id) => {
    const client = useMemo(() => getDbClient(), []);
    // Keys match the NPC page's, so hovering then opening the NPC reuses the data.
    const mapsQ = useQuery({
      queryKey: ['db', 'npc', id, 'maps'],
      queryFn: () => client.getNpcMaps(id),
      staleTime: 5 * 60_000,
    });
    const questsQ = useQuery({
      queryKey: ['db', 'npc', id, 'quests'],
      queryFn: () => client.getNpcQuests(id),
      staleTime: 5 * 60_000,
    });
    return { maps: mapsQ.data?.length ?? 0, quests: questsQ.data?.length ?? 0 };
  },
  renderIcon: (record, id) => (
    <EntityIcon entity="npc" id={id} size={64} placeholder={Users} alt={record.name} />
  ),
  renderName: (record, id) => (
    <Link
      to={routeForEntity('npc', id)}
      className="hover:text-primary block truncate hover:underline"
    >
      {record.name}
    </Link>
  ),
  getSampleId: () =>
    getDbClient()
      .listNpcs({ limit: 1 })
      .then((r) => r.rows[0]?.id ?? null),
  fields,
};
