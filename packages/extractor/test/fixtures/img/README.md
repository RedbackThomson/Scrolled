# Local IMG fixtures

This directory is **gitignored**. Drop an extracted folder of standalone `.img` files here (a HaRepacker-style dump) to run the IMG integration test (`test/integration/img-real.test.ts`) against real game data.

> **Never commit files in this directory.** They are proprietary client data and must stay on your machine. The repository ignores everything in this folder except this README and `.gitkeep`.

## Expected layout

The folder tree mirrors a WZ archive — top-level folders are the WZ roots:

```
img/
  Item/Consume/0200/02000000.img
  Mob/0100100.img
  String/Mob.img
  String/Item.img
  …
```

You can also nest the whole dump under a single parent folder; the test re-roots automatically at the first recognized WZ folder (`Item`, `Mob`, `Npc`, `Map`, `Quest`, `String`, `Character`, …).

## What runs

The region key is auto-detected from a sample image (override with `SCROLLED_WZ_VERSION`). Assertions scale with what you provide:

- structure checks always run (folders surface as `<Folder>.wz`, each with children);
- `Mob/` + `String/` exercises mob extraction;
- `Item/` + `String/` exercises item extraction and icon (canvas → PNG) decoding.

The test skips when this directory is absent or empty.

## WZ fixtures

The WZ-archive counterpart lives in the sibling `../wz/` directory — see its README.
