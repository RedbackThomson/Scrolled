// Demo graph used by the default CLI run and the connectivity test. Names
// below are generic placeholders — see ../README.md for authoring rules.

import { defineGraph } from '../../dsl/builder';
import { item, level, meso, quest } from '../../dsl/requirements';
import type { NavGraphSource } from '../../ir/types';

export const starterGraph: NavGraphSource = defineGraph({ profileId: 'starter-demo' }, (g) => {
  g.region('plains', 'Western Plains', (r) => {
    const riverside = r.node('riverside', 'Riverside');
    const meadow = r.node('meadow', 'Meadow Crossing');
    const oldFort = r.node('old-fort', 'Old Fort');

    riverside.walk(meadow, { seconds: 90 });
    meadow.walk(oldFort, { seconds: 120 });
    riverside.npcTo(oldFort, {
      via: 'Hire the wagon driver at the inn',
      cost: meso(500),
      ref: { npcId: 9_000_001 },
      notes: 'Faster than walking; no return trip.',
    });
  });

  g.region('coast', 'Eastern Coast', (r) => {
    const harbour = r.node('harbour', 'Harbour Town');
    const lighthouse = r.node('lighthouse', 'Lighthouse Point', {
      nearestTown: harbour,
    });

    harbour.walk(lighthouse, { seconds: 150 });
    harbour.skillTo(lighthouse, {
      via: 'Use the bridge-keeper teleport',
      cost: meso(100),
    });
  });

  g.region('mountain', 'Mountain Pass', (r) => {
    const trailhead = r.node('trailhead', 'Trailhead');
    const summit = r.node('summit', 'Summit Shrine', { nearestTown: 'riverside' });

    trailhead.walk(summit, {
      seconds: 300,
      require: [level(20)],
      notes: 'Steep climb — recommended past level 20.',
    });
  });

  g.ref('riverside').portalTo(g.ref('harbour'), {
    via: 'Take the trade road east',
  });
  g.ref('harbour').itemTo(g.ref('lighthouse'), {
    via: 'Use a Lighthouse Pass at the dock',
    require: [item(2_000_001, { consumed: true, name: 'Lighthouse Pass' })],
  });
  g.ref('harbour').npcTo(g.ref('trailhead'), {
    via: 'Take the mountain coach',
    cost: meso(1500),
    ref: { npcId: 9_000_010 },
  });
  g.ref('old-fort').npcTo(g.ref('summit'), {
    via: 'Speak to the surveyor (after completing the survey)',
    require: [quest(7_001, 'Summit Survey')],
    ref: { questId: 7_001 },
  });
  g.ref('harbour').transportTo(g.ref('summit'), {
    via: 'Board the summit ferry',
    seconds: 480,
    notes: 'A long ride — instant with a fast-travel ticket.',
    minor: true,
  });
});
