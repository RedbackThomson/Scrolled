import { useMemo } from 'react';
import {
  compileGraph,
  DEFAULT_GRAPH_ID,
  getGraph,
  type NavGraph,
} from '@scrolled/nav-graph';

export function useNavGraph(profileId: string = DEFAULT_GRAPH_ID): NavGraph {
  return useMemo(() => {
    const source = getGraph(profileId);
    if (!source) {
      throw new Error(`No authored nav graph for profile "${profileId}".`);
    }
    return compileGraph(source);
  }, [profileId]);
}
