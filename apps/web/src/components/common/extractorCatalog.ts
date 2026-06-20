import {
  Armchair,
  Briefcase,
  GitBranch,
  Globe2,
  Map as MapIcon,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { EXTRACT_COUNT_KEYS, type ExtractCountKey } from '@/hooks/extraction/shared';

export interface ExtractorCardMeta {
  label: string;
  Icon: LucideIcon;
}

/**
 * Display metadata for every extractable category — the single source the
 * wizard summary cards and the re-index panel render from. Keyed by
 * `ExtractCountKey` (parser extractors + post-passes), so adding an extractor
 * forces an entry here at compile time: a new category can never silently
 * vanish from the "what you'll explore" / "what was extracted" surfaces.
 */
export const EXTRACTOR_CARD_META: Record<ExtractCountKey, ExtractorCardMeta> = {
  item: { label: 'Items', Icon: Package },
  chair: { label: 'Chairs', Icon: Armchair },
  equip: { label: 'Equips', Icon: Shield },
  mob: { label: 'Mobs', Icon: Skull },
  npc: { label: 'NPCs', Icon: Users },
  map: { label: 'Maps', Icon: MapIcon },
  worldMap: { label: 'World Maps', Icon: Globe2 },
  quest: { label: 'Quests', Icon: ScrollText },
  job: { label: 'Jobs', Icon: Briefcase },
  skill: { label: 'Skills', Icon: Sparkles },
  questChain: { label: 'Quest Chains', Icon: GitBranch },
};

/** Canonical render order for category lists. */
export const EXTRACTOR_CARD_KEYS: readonly ExtractCountKey[] = EXTRACT_COUNT_KEYS;
