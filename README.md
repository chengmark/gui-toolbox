# GUI Toolbox

Electron desktop app built with Vite, React, Tailwind CSS, and shadcn/ui. Packaged with Bun + electron-builder.

## Stack

- **Electron** + **Vite** + **React**
- **Tailwind CSS** v4
- **shadcn/ui**
- **Bun** (install & scripts)

## Getting started

```bash
cd gui-toolbox
bun install
bun run dev
```

## Data layout

Static and user data live under `data/`:

| Path | Contents |
| --- | --- |
| `data/scripts/` | Toggle scripts (`.json`) and one-shot modules (`.mjs`) |
| `data/keybinds/keybind.json` | Global keybind bindings (dev) |
| `data/config/app-settings-default.json` | Packaged factory defaults (seeded into writable settings on first run) |
| `data/config/app-settings.json` | Writable prefs (`common.locale`, `scripts.scriptFavorites`, `translation.enabled`); path configurable in Settings |

Packaged builds keep writable config under Electron `userData/config/`.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start Electron in development mode |
| `bun run build` | Build and package the desktop app |
| `bun run build:dir` | Build unpackaged app directory |
| `bun run typecheck` | TypeScript check |

## Add shadcn components

```bash
bunx --bun shadcn@latest add <component>
```
