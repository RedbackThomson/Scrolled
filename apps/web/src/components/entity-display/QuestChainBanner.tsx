import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { cn } from '@scrolled/design';
import type { QuestChainRecord } from '@scrolled/game-db/db/types';
import { getDbClient } from '@/db';
import { QuestChainLink } from '@/components/entity-links';

// Past this many steps the pips stop reading as a glanceable bar.
const MAX_PIPS = 12;

interface QuestChainBannerProps {
  chain: QuestChainRecord;
  questId: number;
}

/** "Part of <chain>" with pips marking how deep into the chain this quest sits. */
export function QuestChainBanner({ chain, questId }: QuestChainBannerProps) {
  const client = useMemo(() => getDbClient(), []);
  // Shares its cache with the chain's own page.
  const detailQ = useQuery({
    queryKey: ['db', 'quest-chain', chain.id],
    queryFn: () => client.getQuestChain(chain.id),
  });
  const depth = detailQ.data?.members.find((m) => m.questId === questId)?.depth;
  const steps = chain.maxDepth + 1;

  return (
    <div className="bg-muted text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] px-3.5 py-2.5 text-sm">
      <p className="flex min-w-0 items-center gap-2">
        <GitBranch className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Part of{' '}
          <QuestChainLink id={chain.id} className="text-foreground font-semibold hover:underline">
            {chain.name}
          </QuestChainLink>{' '}
          ({chain.size} quests)
        </span>
      </p>
      {depth !== undefined && steps > 1 && (
        <div className="ml-auto flex items-center gap-2">
          {steps <= MAX_PIPS && (
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: steps }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-2 w-[22px] rounded-full',
                    i <= depth ? 'bg-primary' : 'bg-border',
                  )}
                />
              ))}
            </span>
          )}
          <span className="text-xs font-semibold">
            Step {depth + 1} of {steps}
          </span>
        </div>
      )}
    </div>
  );
}
