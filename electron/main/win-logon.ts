/**
 * Windows sign-in launch.
 * Normal startup uses Electron's login item (current user, not elevated).
 * Administrator startup uses a logon scheduled task at RunLevel HighestAvailable.
 * Creating or removing that task needs a one-time UAC prompt unless this process
 * is already elevated. Windows will not elevate a Startup-folder / Run-key app.
 */
import { app } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)

const TASK_NAME = 'GUI Toolbox'

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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function currentUserId(): Promise<string> {
  const { stdout } = await execFileAsync('whoami', [], { windowsHide: true })
  const userId = stdout.trim()
  if (!userId) throw new StartupAdminError('Could not resolve the Windows user name.')
  return userId
}

function taskXml(exePath: string, userId: string): string {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Launch GUI Toolbox at sign-in with administrator rights</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${xmlEscape(userId)}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${xmlEscape(userId)}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(exePath)}</Command>
    </Exec>
  </Actions>
</Task>`
}

async function runSchtasks(args: string[], elevate: boolean): Promise<void> {
  if (!elevate) {
    await execFileAsync('schtasks.exe', args, { windowsHide: true })
    return
  }

  const scriptPath = path.join(
    os.tmpdir(),
    `gui-toolbox-schtasks-${process.pid}-${Date.now()}.ps1`,
  )
  const argList = args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(', ')
  const script = [
    `$p = Start-Process -FilePath 'schtasks.exe' -Verb RunAs -Wait -PassThru -ArgumentList @(${argList})`,
    'if ($null -eq $p) { exit 1 }',
    'exit $p.ExitCode',
    '',
  ].join('\r\n')

  await fs.writeFile(scriptPath, script, 'utf8')
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/cancel/i.test(message)) {
      throw new StartupAdminError(
        'Administrator startup was cancelled. Approve the Windows prompt to enable it.',
      )
    }
    throw new StartupAdminError(
      'Could not register administrator startup. Approve the Windows prompt and try again.',
    )
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined)
  }
}

async function adminTaskExists(): Promise<boolean> {
  try {
    await execFileAsync('schtasks.exe', ['/Query', '/TN', TASK_NAME], {
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

async function deleteAdminTask(): Promise<void> {
  if (!(await adminTaskExists())) return
  try {
    await runSchtasks(['/Delete', '/TN', TASK_NAME, '/F'], false)
  } catch (error) {
    if (error instanceof StartupAdminError) throw error
    await runSchtasks(['/Delete', '/TN', TASK_NAME, '/F'], true)
  }
}

async function createAdminTask(): Promise<void> {
  const userId = await currentUserId()
  const xmlPath = path.join(
    os.tmpdir(),
    `gui-toolbox-logon-${process.pid}-${Date.now()}.xml`,
  )
  const xml = taskXml(process.execPath, userId)
  const body = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(xml, 'utf16le'),
  ])
  await fs.writeFile(xmlPath, body)
  try {
    await runSchtasks(['/Create', '/TN', TASK_NAME, '/XML', xmlPath, '/F'], !isElevated())
  } finally {
    await fs.unlink(xmlPath).catch(() => undefined)
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
    // Elevated logon task and the Run key would both start the app.
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
