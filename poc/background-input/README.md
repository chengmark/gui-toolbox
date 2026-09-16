# Background input POC

Windows-only scripts to test whether a **specific game window** accepts keys while **another app is focused**.

Uses `koffi` from the repo root (`bun install` once).

## Setup (at home, on Windows)

```bash
git fetch origin
git checkout cursor/poc-background-input-6152
bun install
```

Run every command from the **repo root**.

## Test plan

### 1. Find the game window

```bash
bun poc/background-input/list-windows.mjs
bun poc/background-input/list-windows.mjs --process YourGame
bun poc/background-input/list-windows.mjs --title "partial title"
```

Note `HWND` and `PID`.

### 2. Control — focused injection (must work)

Proves scan-code mapping matches the Electron runner (`keybd_event`):

```bash
# Focus the game, then:
bun poc/background-input/foreground-key.mjs --key Space --countdown 3
bun poc/background-input/foreground-key.mjs --key 2 --times 3 --delay 400
```

If this fails while focused, fix targeting/key name before testing background.

### 3. Background — PostMessage (the real POC)

Focus **Notepad / browser** (not the game), then:

```bash
bun poc/background-input/post-key.mjs --hwnd 0xYOURHWND --key Space --times 5 --delay 200
# or:
bun poc/background-input/post-key.mjs --pid YOURPID --key 2 --times 5
bun poc/background-input/post-key.mjs --process YourGame --key Space --method send
```

Optional sustained loop (Ctrl+C to stop):

```bash
bun poc/background-input/run-loop.mjs --process YourGame --key Space --delay 100
```

## How to read results

| Focused `foreground-key` | Unfocused `post-key` | Meaning |
| --- | --- | --- |
| Works | Works | Background scripting is feasible for this game via window messages |
| Works | No effect | Game ignores posted keys (typical Raw Input) — in-app background mode not viable without drivers/injection |
| No effect | — | Wrong window/key, or game needs a different input path |

Try both `--method post` (default) and `--method send`.

## Files

| Path | Role |
| --- | --- |
| `list-windows.mjs` | Enumerate HWND / PID / exe / title |
| `foreground-key.mjs` | Control: `keybd_event` (runner-equivalent) |
| `post-key.mjs` | POC: `PostMessage` / `SendMessage` to HWND |
| `run-loop.mjs` | Sustained background key loop |
| `lib/keys.mjs` | Key → vk/scan (aligned with runner) |
| `lib/win32.mjs` | Win32 bindings |

This branch is for local POC only — do not merge until results are known.
