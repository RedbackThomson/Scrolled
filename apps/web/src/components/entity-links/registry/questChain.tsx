import { GitBranch } from 'lucide-react';
import { getDbClient, type QuestChainDetail } from '@/db';
import type { TooltipEntityConfig, TooltipField } from './types';

type QuestChainField = TooltipField<QuestChainDetail, Record<string, never>>;

const fields: QuestChainField[] = [
  {
    key: 'summary',
    label: 'Summary',
    hint: 'Quest count, stage depth, starts, loops, and parent area.',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'always',
    isPresent: () => true,
    render: ({ record }) => {
      const c = record.chain;
      return (
        <div className="text-muted-foreground text-[11px]">
          {c.size} quests · {c.maxDepth} stages
          {c.rootCount > 1 ? ` · ${c.rootCount} starts` : ''}
          {c.hasCycles ? ' · contains loop' : ''}
          {c.parent ? ` · ${c.parent}` : ''}
        </div>
      );
    },
  },
  {
    key: 'preview',
    label: 'Quest preview',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => record.members.length > 0,
    render: ({ record }) => (
      <p className="text-muted-foreground line-clamp-2 text-xs">
        {record.members
          .slice(0, 3)
          .map((m) => m.questName)
          .join(' → ')}
      </p>
    ),
  },
];

export const questChainConfig: TooltipEntityConfig<QuestChainDetail> = {
  entity: 'questChain',
  idPrefix: 'Chain',
  fetch: (id) => getDbClient().getQuestChain(id),
  queryKey: (id) => ['db', 'quest-chain', id],
  renderIcon: () => (
    <span className="bg-muted text-muted-foreground inline-flex h-16 w-16 shrink-0 items-center justify-center rounded">
      <GitBranch className="h-7 w-7" />
    </span>
  ),
  renderName: (record) => <div className="truncate text-sm font-semibold">{record.chain.name}</div>,
  getSampleId: () =>
    getDbClient().listQuestChains({ limit: 1 }).then((r) => r.rows[0]?.id ?? null),
  fields,
};
