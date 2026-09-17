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
| `bun run release` | Build and publish to GitHub Releases |
| `bun run typecheck` | TypeScript check |

## Releases

Merging a PR into `main` runs GitHub Actions (`.github/workflows/release.yml`), which:

1. Auto-bumps the patch version in `package.json` (e.g. `0.1.0` → `0.1.1`) and commits it with `[skip ci]`
2. Builds release notes from commits since the previous `v*` tag (excluding `[skip ci]` bumps)
3. Builds the Windows NSIS installer
4. Publishes a GitHub Release for that version (used by in-app auto-update)

You do not need to bump the version in feature PRs.

## Add shadcn components

```bash
bunx --bun shadcn@latest add <component>
```
