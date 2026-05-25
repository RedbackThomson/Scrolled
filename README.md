# Mushroom Game Explorer

A self-hostable, local-first wiki for Mushroom Game data.

The app parses **your own local game files** in your browser and renders pages for items, equips, mobs, NPCs, maps, and quests. Nothing is uploaded; nothing leaves your machine.

> **Ship code only.** This repository contains no proprietary game data — no `.wz` archives, no extracted `.img` files, no sprites, no pre-built databases. You provide your own files at runtime.

## Status

Pre-alpha. Phase 0 (scaffold). See [`docs/technical_requirements.md`](docs/technical_requirements.md) for the phase plan.

## Legal notice

This project is not affiliated with, endorsed by, or sponsored by any game operator or rights holder. All trademarks, trade names, and copyrighted material belong to their respective owners. This repository ships code only — it does not include, distribute, or host any game data, assets, or branding.

You are responsible for ensuring that any files you load are files you are legally permitted to use. The maintainers do not distribute, host, or store such files.

## Quickstart

Requirements: Node 20+, [pnpm](https://pnpm.io/) 9+.

```bash
pnpm install
pnpm dev
```

Then open the printed URL.

### Nix users

A flake is provided. With Nix + flakes enabled:

```bash
nix develop
pnpm install
pnpm dev
```

Or, with [direnv](https://direnv.net/) installed, `direnv allow` will load the dev shell automatically.

## Reporting parser issues

If something goes wrong loading WZ files, open the **Parser debug** page in the
sidebar and click **Copy log**. That captures the parser's log buffer (main
thread + worker), the AES smoke-test result, and minimal environment info.
Paste that into your GitHub issue along with what you tried.

For extra verbosity, set `localStorage.setItem('mge.debug', '1')` in the
browser console before reproducing — that enables debug-level entries that are
otherwise filtered out of the console (they're always captured in the buffer).

## Scripts

| Script           | What it does                               |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Start the Vite dev server for the web app. |
| `pnpm build`     | Production build.                          |
| `pnpm preview`   | Preview the production build locally.      |
| `pnpm typecheck` | Run TypeScript in all packages.            |
| `pnpm lint`      | Run ESLint in all packages.                |
| `pnpm test`      | Run Vitest in all packages.                |
| `pnpm format`    | Format the repo with Prettier.             |

## Layout

```
apps/web/        Vite + React + TS app (the wiki UI)
docs/            Product and technical requirements
```

See [`CLAUDE.md`](CLAUDE.md) for the rules every change in this repo follows.

## License

MIT — see [LICENSE](LICENSE).
