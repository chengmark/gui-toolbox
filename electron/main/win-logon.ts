/**
 * Windows sign-in launch.
 * Normal startup uses Electron's login item (current user, not elevated).
 * Administrator startup registers a logon scheduled task at RunLevel Highest.
 * Creating that task needs one UAC prompt unless this process is already elevated.
 * Windows will not elevate a Startup-folder / Run-key app.
 */
import { app } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)

/** No spaces: Start-Process mangles quoted arguments, and schtasks splits this name. */
const TASK_NAME = 'GUIToolbox'
const LEGACY_TASK_NAME = 'GUI Toolbox'
const DONE = '__DONE__'

export class StartupAdminError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StartupAdminError'
  }
}

function isElevated(): boolean {
  if (process.platform !== 'win32') return false
  try {
    execFileSync('net', ['session'], { stdio: 'ignore', windowsHide: true })
    return true
  } catch {
    return false
  }
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function vbsQuote(value: string): string {
  return value.replace(/"/g, '""')
}

async function currentUserId(): Promise<string> {
  const { stdout } = await execFileAsync('whoami.exe', [], { windowsHide: true })
  const userId = stdout.trim()
  if (!userId) {
    throw new StartupAdminError('Could not resolve the Windows user name.')
  }
  return userId
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function isCancelled(text: string): boolean {
  return /cancel|1223|800704c7|2147023673|取消/i.test(text)
}

function resultMessage(log: string): string {
  return log
    .replaceAll(DONE, '')
    .replace(/^\uFEFF/, '')
    .trim()
}

async function runPowerShell(script: string, elevate: boolean): Promise<void> {
  const id = `${process.pid}-${Date.now()}`
  const dir = os.tmpdir()
  const scriptPath = path.join(dir, `gui-toolbox-startup-${id}.ps1`)
  const logPath = path.join(dir, `gui-toolbox-startup-${id}.log`)
  const vbsPath = path.join(dir, `gui-toolbox-startup-${id}.vbs`)

  const body = [
    '$ErrorActionPreference = \'Stop\'',
    'try {',
    script,
    `  Set-Content -LiteralPath ${psQuote(logPath)} -Encoding UTF8 -Value "OK\`r\`n${DONE}"`,
    '  exit 0',
    '} catch {',
    `  Set-Content -LiteralPath ${psQuote(logPath)} -Encoding UTF8 -Value ($_.Exception.Message + "\`r\`n${DONE}")`,
    '  exit 1',
    '}',
    '',
  ].join('\r\n')

  await fs.writeFile(scriptPath, `\uFEFF${body}`, 'utf8')

  try {
    if (!elevate) {
      try {
        await execFileAsync(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
          { windowsHide: true },
        )
      } catch {
        // The script writes the real error to the log.
      }
    } else {
      const psArgs = `-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptPath}"`
      const vbs = [
        'On Error Resume Next',
        'Set shell = CreateObject("Shell.Application")',
        `shell.ShellExecute "powershell.exe", "${vbsQuote(psArgs)}", "", "runas", 0`,
        'If Err.Number <> 0 Then',
        '  Set stream = CreateObject("Scripting.FileSystemObject").CreateTextFile("' +
          vbsQuote(logPath) +
          '", True)',
        '  stream.WriteLine "CANCELLED " & Err.Number & " " & Err.Description',
        `  stream.WriteLine "${DONE}"`,
        '  stream.Close',
        'End If',
        '',
      ].join('\r\n')
      await fs.writeFile(vbsPath, vbs, 'utf8')
      await execFileAsync('wscript.exe', ['//nologo', vbsPath], { windowsHide: true })

      const deadline = Date.now() + 3 * 60 * 1000
      let log: string | null = null
      while (Date.now() < deadline) {
        log = await readText(logPath)
        if (log?.includes(DONE)) break
        await sleep(250)
      }
      if (!log?.includes(DONE)) {
        throw new StartupAdminError(
          'Timed out waiting for the Windows permission prompt.',
        )
      }
    }

    const log = (await readText(logPath)) ?? ''
    const detail = resultMessage(log)
    if (isCancelled(detail) || isCancelled(log)) {
      throw new StartupAdminError(
        'Administrator startup was cancelled. Approve the Windows prompt to enable it.',
      )
    }
    if (!/^OK\b/.test(detail)) {
      throw new StartupAdminError(
        detail
          ? `Could not register administrator startup. ${detail}`
          : 'Could not register administrator startup.',
      )
    }
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined)
    await fs.unlink(logPath).catch(() => undefined)
    await fs.unlink(vbsPath).catch(() => undefined)
  }
}

function registerScript(exePath: string, userId: string): string {
  return [
    `Unregister-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Confirm:$false -ErrorAction SilentlyContinue`,
    `Unregister-ScheduledTask -TaskName ${psQuote(LEGACY_TASK_NAME)} -Confirm:$false -ErrorAction SilentlyContinue`,
    `$action = New-ScheduledTaskAction -Execute ${psQuote(exePath)}`,
    `$trigger = New-ScheduledTaskTrigger -AtLogOn -User ${psQuote(userId)}`,
    `$principal = New-ScheduledTaskPrincipal -UserId ${psQuote(userId)} -LogonType Interactive -RunLevel Highest`,
    '$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries',
    "$settings.ExecutionTimeLimit = 'PT0S'",
    `Register-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null`,
  ].join('\r\n')
}

function removeScript(): string {
  return [
    `Unregister-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Confirm:$false -ErrorAction SilentlyContinue`,
    `Unregister-ScheduledTask -TaskName ${psQuote(LEGACY_TASK_NAME)} -Confirm:$false -ErrorAction SilentlyContinue`,
  ].join('\r\n')
}

async function createAdminTask(): Promise<void> {
  const userId = await currentUserId()
  await runPowerShell(registerScript(process.execPath, userId), !isElevated())
}

async function deleteAdminTask(): Promise<void> {
  try {
    await runPowerShell(removeScript(), false)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/access is denied|拒绝访问|0x80070005/i.test(message)) throw error
    await runPowerShell(removeScript(), true)
  }
}

function setUserLoginItem(enabled: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
    })
  } catch {
    // ignore — unpackaged or unsupported platform
  }
}

/**
 * @param interactive When true, create or delete the elevated task (may show UAC).
 *                    Boot sync only adjusts the normal login item so we don't prompt every launch.
 */
export async function applyWindowsStartup(options: {
  openAtLogin: boolean
  asAdmin: boolean
  interactive: boolean
}): Promise<void> {
  if (process.platform !== 'win32') return

  const wantAdmin = options.openAtLogin && options.asAdmin

  if (!app.isPackaged) {
    setUserLoginItem(false)
    if (options.interactive && wantAdmin) {
      throw new StartupAdminError(
        'Administrator startup only works in the installed app.',
      )
    }
    return
  }

  if (!options.interactive) {
    setUserLoginItem(options.openAtLogin && !options.asAdmin)
    return
  }

  if (wantAdmin) {
    setUserLoginItem(false)
    await createAdminTask()
    return
  }

  await deleteAdminTask()
  setUserLoginItem(options.openAtLogin)
}
