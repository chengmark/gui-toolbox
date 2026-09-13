import { BrowserWindow, screen } from 'electron'

export type AppToastMode = 'loading' | 'success' | 'error'

export type AppToastPayload = {
  mode: AppToastMode
  title: string
  message?: string
  /** Auto-hide after ms. Loading ignores this and stays until replaced. */
  durationMs?: number
}

const TOAST_WIDTH = 360
const TOAST_HEIGHT = 72
const DEFAULT_SUCCESS_MS = 3000

let toastWin: BrowserWindow | null = null
let hideTimer: NodeJS.Timeout | null = null
let ready = false
let pending: AppToastPayload | null = null

function toastHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #1f1f1f;
      --border: #333333;
      --fg: #e8e8e8;
      --muted: #9a9a9a;
      --ok: #3fb950;
      --err: #f14c4c;
      --accent: #0078d4;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
      font: 12px/1.35 "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
      -webkit-user-select: none;
      user-select: none;
    }
    #toast {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      height: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--bg);
      color: var(--fg);
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 200ms ease, transform 200ms ease;
      pointer-events: none;
    }
    #toast.visible {
      opacity: 1;
      transform: translateY(0);
    }
    #toast.leaving {
      opacity: 0;
      transform: translateY(-4px);
    }
    .icon {
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #2a2a2a;
    }
    .icon svg { width: 16px; height: 16px; display: block; }
    .icon.loading { color: var(--accent); }
    .icon.success { color: var(--ok); }
    .icon.error { color: var(--err); }
    .spin {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid rgba(0, 120, 212, 0.25);
      border-top-color: var(--accent);
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .copy { min-width: 0; flex: 1; }
    .title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .message {
      margin-top: 2px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .message:empty { display: none; }
  </style>
</head>
<body>
  <div id="toast" aria-live="polite">
    <div class="icon loading" id="icon"><div class="spin"></div></div>
    <div class="copy">
      <div class="title" id="title">Working…</div>
      <div class="message" id="message"></div>
    </div>
  </div>
  <script>
    const toast = document.getElementById('toast');
    const icon = document.getElementById('icon');
    const titleEl = document.getElementById('title');
    const messageEl = document.getElementById('message');

    const ICONS = {
      loading: '<div class="spin"></div>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    };

    window.setToast = function setToast(payload) {
      const mode = payload && payload.mode ? payload.mode : 'loading';
      titleEl.textContent = (payload && payload.title) || '';
      messageEl.textContent = (payload && payload.message) || '';
      icon.className = 'icon ' + mode;
      icon.innerHTML = ICONS[mode] || ICONS.loading;
      toast.classList.remove('leaving');
      requestAnimationFrame(function () {
        toast.classList.add('visible');
      });
    };

    window.fadeOutToast = function fadeOutToast() {
      toast.classList.add('leaving');
      toast.classList.remove('visible');
    };
  </script>
</body>
</html>`
}

function clearHideTimer(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function targetDisplay() {
  const point = screen.getCursorScreenPoint()
  return screen.getDisplayNearestPoint(point)
}

function positionWindow(win: BrowserWindow): void {
  const { workArea } = targetDisplay()
  const x = Math.round(workArea.x + (workArea.width - TOAST_WIDTH) / 2)
  const y = Math.round(workArea.y + 20)
  // setContentSize + setPosition avoids Windows frameless size glitches.
  win.setContentSize(TOAST_WIDTH, TOAST_HEIGHT)
  win.setPosition(x, y, false)
}

async function ensureWindow(): Promise<BrowserWindow> {
  if (toastWin && !toastWin.isDestroyed()) {
    positionWindow(toastWin)
    if (!toastWin.isVisible()) toastWin.showInactive()
    return toastWin
  }

  ready = false
  // Opaque frameless window: transparent:true often clips to a thin strip on Windows.
  toastWin = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: true,
    thickFrame: false,
    backgroundColor: '#1f1f1f',
    roundedCorners: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  toastWin.setAlwaysOnTop(true, 'screen-saver')
  toastWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  toastWin.setMenuBarVisibility(false)
  positionWindow(toastWin)

  toastWin.webContents.once('did-finish-load', () => {
    ready = true
    if (toastWin && !toastWin.isDestroyed()) {
      positionWindow(toastWin)
    }
    if (pending) {
      void applyToast(pending)
      pending = null
    }
  })

  toastWin.on('closed', () => {
    toastWin = null
    ready = false
    clearHideTimer()
  })

  await toastWin.loadURL(
    `data:text/html;charset=UTF-8,${encodeURIComponent(toastHtml())}`,
  )
  positionWindow(toastWin)
  toastWin.showInactive()
  // Re-assert size after show — Windows can shrink frameless windows once.
  positionWindow(toastWin)
  return toastWin
}

async function applyToast(payload: AppToastPayload): Promise<void> {
  const win = await ensureWindow()
  if (!ready) {
    pending = payload
    return
  }

  clearHideTimer()
  positionWindow(win)
  const safe = JSON.stringify({
    mode: payload.mode,
    title: payload.title,
    message: payload.message ?? '',
  })
  await win.webContents.executeJavaScript(`window.setToast(${safe})`)

  if (payload.mode === 'loading') return

  const duration = payload.durationMs ?? DEFAULT_SUCCESS_MS
  hideTimer = setTimeout(() => {
    void hideAppToast()
  }, duration)
}

export async function showAppToast(payload: AppToastPayload): Promise<void> {
  await applyToast(payload)
}

export async function hideAppToast(): Promise<void> {
  clearHideTimer()
  if (!toastWin || toastWin.isDestroyed()) return
  try {
    await toastWin.webContents.executeJavaScript('window.fadeOutToast()')
  } catch {
    // ignore
  }
  setTimeout(() => {
    if (toastWin && !toastWin.isDestroyed()) {
      toastWin.hide()
    }
  }, 220)
}

export function destroyAppToast(): void {
  clearHideTimer()
  pending = null
  if (toastWin && !toastWin.isDestroyed()) {
    toastWin.destroy()
  }
  toastWin = null
  ready = false
}
