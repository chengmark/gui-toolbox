# Data layout

Version-controlled and runtime data for GUI Toolbox.

```
data/
├── scripts/     # Toggle scripts (*.json) and one-shot modules (*.mjs)
├── keybinds/    # Dev keybind store (keybind.json)
└── config/
    ├── app-settings-default.json  # Packaged factory defaults (read-only template)
    ├── app-settings.json          # Writable runtime prefs (dev; packaged → userData)
    └── translator-settings.json
```

## Path resolution

| Asset | Development | Packaged |
| --- | --- | --- |
| Scripts | `data/scripts/` | `resources/data/scripts/` |
| Keybinds | `data/keybinds/keybind.json` | `%APPDATA%/GUI Toolbox/config/keybind.json` |
| Factory defaults | `data/config/app-settings-default.json` | `resources/data/config/app-settings-default.json` |
| App settings | `data/config/app-settings.json` (or custom path from Settings) | `%APPDATA%/GUI Toolbox/config/app-settings.json` (or custom) |
| Translator settings | `data/config/translator-settings.json` | `%APPDATA%/GUI Toolbox/config/translator-settings.json` |

On first launch (no writable settings file yet), the app copies `app-settings-default.json` into the writable `app-settings.json` location.

`app-settings.json` auto-saves modular prefs:

```json
{
  "common": {
    "locale": null,
    "openAtLogin": false,
    "closeAction": "ask"
  },
  "scripts": {
    "schemaVersion": 1,
    "scriptFavorites": [],
    "folderPath": null
  },
  "translation": { "enabled": false },
  "updates": { "skippedVersion": null }
}
```

- `openAtLogin` — launch with Windows (packaged builds)
- `closeAction` — `ask` (prompt), `tray` (hide to tray), or `quit` (exit). The close prompt can remember a choice.

A custom settings path is remembered in `%APPDATA%/GUI Toolbox/app-settings-location.json`.
