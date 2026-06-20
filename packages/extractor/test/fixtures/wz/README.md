# Local WZ fixtures

This directory is **gitignored**. Drop your own MapleRoyals (or compatible) WZ files here to run the parser integration tests against real game data.

> **Never commit files in this directory.** They are proprietary client data and must stay on your machine. The repository ignores everything in this folder except this README and `.gitkeep`.

## Expected files

The integration tests look for these by default:

| File        | Used for                                                 |
| ----------- | -------------------------------------------------------- |
| `String.wz` | item / equip / mob / NPC / map / quest localized strings |
| `Item.wz`   | item metadata                                            |
| `Mob.wz`    | mob metadata (optional)                                  |
| `Npc.wz`    | NPC metadata (optional)                                  |
| `Map.wz`    | map metadata (optional)                                  |
| `Quest.wz`  | quest metadata (optional)                                |
| `Skill.wz`  | skill metadata (optional)                                |

Tests skip gracefully when any expected file is missing, so you can drop in just `String.wz` + `Item.wz` and add the rest later.

## Encryption version

The default is `GMS` ("old GMS" — the encryption MapleRoyals' v83-era client uses). Override per-run via the `SCROLLED_WZ_VERSION` environment variable:

```bash
SCROLLED_WZ_VERSION=GMS pnpm test
```

Accepted values: `BMS`, `GMS`, `EMS`, `CLASSIC`.

## Optional: known-item assertions

If you want a test to verify a specific item parses to a known name, set:

```bash
SCROLLED_KNOWN_ITEM_ID=2000000 SCROLLED_KNOWN_ITEM_NAME='Red Potion' pnpm test
```

Without those env vars, the integration test asserts only generic structure (top-level dirs present, at least one item resolvable).

## IMG fixtures

The binary `.img` counterpart lives in the sibling `../img/` directory — see its README.
