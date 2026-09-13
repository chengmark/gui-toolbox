# gui-toolbox script schema (v1)

Canonical JSON format for **toggle-controlled** automation scripts in `data/scripts/`.

Scripts turn on/off with a toggle key and run the main loop until toggled off (or a step-defined stop condition). For one-shot press-to-run actions, use **Keybinds** (`.mjs` + `data/keybinds/keybind.json`) instead.

```json
{
  "schemaVersion": 1,
  "name": "Display name",
  "toggle": "home",
  "initial": [{ "command": "Delay", "args": [100] }],
  "loop": [{ "command": "KeyPress", "args": ["1", 1] }],
  "background": [{ "command": "ToggleMute", "args": ["MB5"] }],
  "subroutines": [
    { "kind": "process", "file": "limit_download.mjs", "args": [1234, "5 KB"] },
    { "kind": "inline", "id": "combo", "loop": [] }
  ]
}
```

## Rules

- Use `toggle` only (no `trigger` — that belongs to Keybinds)
- Use `name` (not `description`)
- Use `loop` (not legacy `steps`)
- Use `subroutines` (not `scripts`)
- Commands are PascalCase (`RunScript`, not `run_script`)
- Process subroutines are JS modules (`.mjs`), not Python
- Omit empty optional arrays/fields

The Electron app normalizes legacy documents on read/write and strips any legacy `trigger` field.
