import { useMemo } from 'react';
import { compileGraph, type NavGraph } from '@scrolled/nav-graph';

import navGraphSource from '@/nav-graph-data';

export function useNavGraph(): NavGraph {
  return useMemo(() => compileGraph(navGraphSource), []);
}
