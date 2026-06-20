# Scrolled

A wiki-style explorer for old-school Mushroom Game data — items, equips, mobs, NPCs, maps, and quests — that runs entirely in your browser.

👉 **Try it now:** [scrolled.dev](https://scrolled.dev)

## ✨ What it does

Point the app at your own local game files and it builds a searchable wiki out of them: detail pages for every item and mob, infoboxes with stats and drops, a global search bar, and a Cmd/Ctrl+K command palette to jump anywhere.

🔒 Everything happens on your machine. Your files are read in the browser, parsed in a background worker, and indexed locally. Nothing is uploaded, no analytics are collected, and the app makes no network calls beyond loading its own static assets.

## 🚀 How to use it

1. Open [scrolled.dev](https://scrolled.dev) (or run it locally — see below).
2. On the setup screen, select your local `.wz` files: `String.wz`, `Item.wz`, `Map.wz`, `Mob.wz`, `Npc.wz`, `Quest.wz`, `Skill.wz`, and related files.
3. Wait for parsing to finish. The app builds an index and caches it locally so reopening the app is fast.
4. Search, browse, and explore.

You can also export and re-import a local backup of the parsed index from the setup screen, which skips the parsing step on other devices.

## 🛠️ Running it yourself

The hosted version is the easiest way to use the app, but the whole thing is just static files — you can also clone the repo and run it on your own machine.

You'll need [Node.js](https://nodejs.org/) 20 or newer and [pnpm](https://pnpm.io/) 9 or newer.

```bash
git clone https://github.com/RedbackThomson/scrolled.git
cd scrolled
pnpm install
pnpm build
pnpm preview
```

The `preview` command starts a local server and prints the URL. The contents of `apps/web/dist/` after `pnpm build` are plain static files — you can also serve them with any static file server (e.g. `npx serve apps/web/dist`) or host them anywhere that serves static content.

## 📦 Host a prebuilt dataset

You can also publish a **fixed-dataset** version of the site — one that ships a ready-made library (e.g. a specific server's data) that visitors download once and use offline, with no file import. The same codebase builds it from deployment config; the game data and manifests live in a separate repository you control, never here.

[**HOSTING.md**](HOSTING.md) is the developer runbook: building the dataset artifact, wiring it through CI, and keeping it in sync with both the game data and the latest app version. The architecture behind it is in [docs/fixed_dataset_deployment.md](docs/fixed_dataset_deployment.md).

## 🤖 Use it from an AI agent (MCP)

The app exposes its read-and-write surface as [MCP](https://modelcontextprotocol.io/) tools — every map, item, mob, quest, collection, and setting is reachable from any MCP-speaking client (Claude Desktop, IDE plugins, your own scripts) and from a bundled CLI. Tool execution stays inside the browser, so your data never leaves the tab.

### Enable the bridge

In the app, go to **Settings → External Tools** and flip the toggle on. By default the tab will dial out to `ws://localhost:8765`; change the URL there if you need a different port. Off by default — nothing happens until you opt in.

### Run a local MCP server

The server is a small Node process that hosts the WebSocket the tab connects to and speaks MCP stdio upstream:

```bash
pnpm --filter @scrolled/mcp-server start
```

Leave it running. The browser tab will connect when the Settings toggle is on.

### Connect Claude Desktop

Add an entry to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the platform equivalent:

```json
{
  "mcpServers": {
    "scrolled": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/absolute/path/to/scrolled/packages/mcp-server/src/cli.ts"
      ]
    }
  }
}
```

Restart Claude Desktop. The Scrolled tools appear in its tool list — ask things like "use scrolled to find maps named henesys" or "show me what bigfoot drops".

Only one host can serve the bridge at a time. If you started `mcp-server` manually, let Claude Desktop spawn its own copy instead (or vice versa) — don't run both.

### Try it from the CLI

The bundled CLI is the quickest way to verify everything's wired up:

```bash
# List every registered tool
pnpm --filter @scrolled/mcp-cli exec scrolled-mcp list

# Schema for one tool
pnpm --filter @scrolled/mcp-cli exec scrolled-mcp describe maps.search

# Invoke a tool — JSON in, JSON out
pnpm --filter @scrolled/mcp-cli exec scrolled-mcp call maps.search --input '{"limit":5}'
pnpm --filter @scrolled/mcp-cli exec scrolled-mcp call search.global --input '{"q":"henesys"}'
pnpm --filter @scrolled/mcp-cli exec scrolled-mcp call collections.list --input '{}'
pnpm --filter @scrolled/mcp-cli exec scrolled-mcp call db.gameStatus --input '{}'
```

If the CLI sits at "waiting for the browser tab to connect", the Settings toggle is off or the URL doesn't match. The status pill in Settings flips to **Connected** when the bridge is live.

## ⚖️ Your files, your machine

This repository contains **only code**. It does not ship any game data — no `.wz` archives, no extracted assets, no sprites, no pre-built databases. You bring your own files at runtime, and those files never leave your browser.

You are responsible for ensuring that any files you load are files you are legally permitted to use. This project is not affiliated with, endorsed by, or sponsored by any game operator or rights holder. All trademarks and copyrighted material belong to their respective owners.

## Contributing

Development setup, project layout, scripts, and debugging guidance live in [DEVELOPMENT.md](DEVELOPMENT.md). Repository-wide rules for contributors and AI assistants are in [CLAUDE.md](CLAUDE.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).
