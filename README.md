# 🍄 Mushroom Explorer

A wiki-style explorer for old-school Mushroom Game data — items, equips, mobs, NPCs, maps, and quests — that runs entirely in your browser.

👉 **Try it now:** [mushroomexplorer.redback.dev](https://mushroomexplorer.redback.dev)

## ✨ What it does

Point the app at your own local game files and it builds a searchable wiki out of them: detail pages for every item and mob, infoboxes with stats and drops, a global search bar, and a Cmd/Ctrl+K command palette to jump anywhere.

🔒 Everything happens on your machine. Your files are read in the browser, parsed in a background worker, and indexed locally. Nothing is uploaded, no analytics are collected, and the app makes no network calls beyond loading its own static assets.

## 🚀 How to use it

1. Open [mushroomexplorer.redback.dev](https://mushroomexplorer.redback.dev) (or run it locally — see below).
2. On the setup screen, select your local `.wz` files: `String.wz`, `Item.wz`, `Map.wz`, `Mob.wz`, `Npc.wz`, `Quest.wz`, `Skill.wz`, and related files.
3. Wait for parsing to finish. The app builds an index and caches it locally so reopening the app is fast.
4. Search, browse, and explore.

You can also export and re-import a local backup of the parsed index from the setup screen, which skips the parsing step on other devices.

## 🛠️ Running it yourself

The hosted version is the easiest way to use the app, but the whole thing is just static files — you can also clone the repo and run it on your own machine.

You'll need [Node.js](https://nodejs.org/) 20 or newer and [pnpm](https://pnpm.io/) 9 or newer.

```bash
git clone https://github.com/RedbackThomson/MushroomExplorer.git
cd MushroomExplorer
pnpm install
pnpm build
pnpm preview
```

The `preview` command starts a local server and prints the URL. The contents of `apps/web/dist/` after `pnpm build` are plain static files — you can also serve them with any static file server (e.g. `npx serve apps/web/dist`) or host them anywhere that serves static content.

## ⚖️ Your files, your machine

This repository contains **only code**. It does not ship any game data — no `.wz` archives, no extracted assets, no sprites, no pre-built databases. You bring your own files at runtime, and those files never leave your browser.

You are responsible for ensuring that any files you load are files you are legally permitted to use. This project is not affiliated with, endorsed by, or sponsored by any game operator or rights holder. All trademarks and copyrighted material belong to their respective owners.

## Contributing

Development setup, project layout, scripts, and debugging guidance live in [DEVELOPMENT.md](DEVELOPMENT.md). Repository-wide rules for contributors and AI assistants are in [CLAUDE.md](CLAUDE.md).

## License

MIT — see [LICENSE](LICENSE).
