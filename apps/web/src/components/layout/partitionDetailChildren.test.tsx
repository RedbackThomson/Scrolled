import { describe, expect, it } from 'vitest';
import { Package, Map as MapIcon } from 'lucide-react';
import { partitionDetailChildren } from './partitionDetailChildren';
import { DetailListSection } from './DetailListSection';
import { DetailSection } from './DetailPageLayout';

describe('partitionDetailChildren', () => {
  it('tabs direct list sections and keeps everything else as intro', () => {
    const { intro, sections } = partitionDetailChildren(
      <>
        <DetailSection title="Description">text</DetailSection>
        <DetailListSection icon={Package} title="Drops" count={3} />
        {false}
        <>
          <DetailListSection icon={MapIcon} title="Appears on" />
        </>
      </>,
    );
    expect(intro).toHaveLength(1);
    expect(sections.map((s) => [s.key, s.label, s.count])).toEqual([
      ['drops', 'Drops', 3],
      ['appears-on', 'Appears on', undefined],
    ]);
  });

  it('gives repeated titles distinct keys', () => {
    const { sections } = partitionDetailChildren([
      <DetailListSection key="a" icon={Package} title="Quests" />,
      <DetailListSection key="b" icon={Package} title="Quests" />,
    ]);
    expect(sections.map((s) => s.key)).toEqual(['quests', 'quests-2']);
  });
});
