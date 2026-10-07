import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { DetailListSection } from './DetailListSection';

export interface DetailTabSection {
  key: string;
  label: string;
  count?: number;
  node: ReactElement;
}

function flatten(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((n) =>
    isValidElement<{ children?: ReactNode }>(n) && n.type === Fragment
      ? flatten(n.props.children)
      : [n],
  );
}

/**
 * Splits a detail page's children into intro content (always shown) and the
 * list sections that become mobile tabs. Only direct `DetailListSection`s are
 * tabbed; anything wrapping one stays in the intro so it's never lost.
 */
export function partitionDetailChildren(children: ReactNode): {
  intro: ReactNode[];
  sections: DetailTabSection[];
} {
  const intro: ReactNode[] = [];
  const sections: DetailTabSection[] = [];
  const used = new Set<string>();
  for (const node of flatten(children)) {
    if (
      isValidElement<{ title: string; count?: number }>(node) &&
      node.type === DetailListSection
    ) {
      const base = node.props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let key = base;
      for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
      used.add(key);
      sections.push({ key, label: node.props.title, count: node.props.count, node });
    } else {
      intro.push(node);
    }
  }
  return { intro, sections };
}
