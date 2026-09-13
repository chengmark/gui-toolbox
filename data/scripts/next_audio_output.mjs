/**
 * Cycle the Windows default playback (output) device to the next active one.
 *
 * Uses Core Audio + undocumented IPolicyConfig (same approach as AudioDeviceCmdlets).
 * Requires Windows; no extra PowerShell modules.
 *
 * export default async function () { ... }
 */
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execFileAsync = promisify(execFile)

const POWERSHELL = `
$ErrorActionPreference = 'Stop'

$csharp = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public enum EDataFlow { eRender, eCapture, eAll }
public enum ERole { eConsole, eMultimedia, eCommunications }
public enum EDeviceState {
  Active = 0x00000001,
  Disabled = 0x00000002,
  NotPresent = 0x00000004,
  Unplugged = 0x00000008,
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
  void Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
  void OpenPropertyStore(int stgmAccess, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore ppProperties);
  void GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
  void GetState(out int pdwState);
}

[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceCollection {
  void GetCount(out uint pcDevices);
  void Item(uint nDevice, out IMMDevice ppDevice);
}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
  void EnumAudioEndpoints(EDataFlow dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
  void GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
  void GetDevice(string pwstrId, out IMMDevice ppDevice);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
  void GetCount(out uint cProps);
  void GetAt(uint iProp, out PROPERTYKEY pkey);
  void GetValue(ref PROPERTYKEY key, out PropVariant pv);
  void SetValue(ref PROPERTYKEY key, ref PropVariant pv);
  void Commit();
}

[StructLayout(LayoutKind.Sequential)]
public struct PROPERTYKEY {
  public Guid fmtid;
  public uint pid;
}

[StructLayout(LayoutKind.Sequential)]
public struct PropVariant {
  public short vt;
  public short wReserved1;
  public short wReserved2;
  public short wReserved3;
  public IntPtr p;
  public int p2;
}

[ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPolicyConfig {
  [PreserveSig] int GetMixFormat();
  [PreserveSig] int GetDeviceFormat();
  [PreserveSig] int ResetDeviceFormat();
  [PreserveSig] int SetDeviceFormat();
  [PreserveSig] int GetProcessingPeriod();
  [PreserveSig] int SetProcessingPeriod();
  [PreserveSig] int GetShareMode();
  [PreserveSig] int SetShareMode();
  [PreserveSig] int GetPropertyValue();
  [PreserveSig] int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string deviceId, ERole role);
  [PreserveSig] int SetEndpointVisibility();
}

[ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
internal class PolicyConfigClient { }

public static class NextAudioOutput {
  static readonly PROPERTYKEY PKEY_Device_FriendlyName = new PROPERTYKEY {
    fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
    pid = 14,
  };

  public static string Run() {
    var enumerator = (IMMDeviceEnumerator)(object)new MMDeviceEnumeratorComObject();
    IMMDeviceCollection collection;
    enumerator.EnumAudioEndpoints(EDataFlow.eRender, (int)EDeviceState.Active, out collection);

    uint count;
    collection.GetCount(out count);
    if (count == 0) throw new Exception("No active playback devices");

    var devices = new List<string>();
    var names = new List<string>();
    for (uint i = 0; i < count; i++) {
      IMMDevice device;
      collection.Item(i, out device);
      string id;
      device.GetId(out id);
      devices.Add(id);
      names.Add(GetFriendlyName(device) ?? id);
    }

    IMMDevice current;
    enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out current);
    string currentId;
    current.GetId(out currentId);

    int index = devices.FindIndex(id => string.Equals(id, currentId, StringComparison.OrdinalIgnoreCase));
    int next = index < 0 ? 0 : (index + 1) % devices.Count;
    string nextId = devices[next];
    string nextName = names[next];

    var policy = (IPolicyConfig)(object)new PolicyConfigClient();
    Marshal.ThrowExceptionForHR(policy.SetDefaultEndpoint(nextId, ERole.eConsole));
    Marshal.ThrowExceptionForHR(policy.SetDefaultEndpoint(nextId, ERole.eMultimedia));
    Marshal.ThrowExceptionForHR(policy.SetDefaultEndpoint(nextId, ERole.eCommunications));
    return nextName;
  }

  static string GetFriendlyName(IMMDevice device) {
    try {
      IPropertyStore store;
      device.OpenPropertyStore(0 /*STGM_READ*/, out store);
      PropVariant value;
      var key = PKEY_Device_FriendlyName;
      store.GetValue(ref key, out value);
      if (value.vt == 31 /*VT_LPWSTR*/ && value.p != IntPtr.Zero) {
        return Marshal.PtrToStringUni(value.p);
      }
    } catch { }
    return null;
  }
}
'@

try {
  Add-Type -TypeDefinition $csharp -Language CSharp -ErrorAction Stop
} catch {
  if ($_.Exception.Message -notmatch 'already exists') { throw }
}

$name = [NextAudioOutput]::Run()
Write-Output $name
`

function assertWindows() {
  if (process.platform !== "win32") {
    throw new Error("next_audio_output.mjs only supports Windows")
  }
}

export default async function run() {
  assertWindows()

  const { stdout, stderr } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", POWERSHELL],
    {
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 15_000,
    },
  )

  const name = String(stdout ?? "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1)

  if (stderr?.trim()) {
    console.warn("[next_audio_output]", stderr.trim())
  }

  if (!name) {
    throw new Error("Failed to switch audio output device")
  }

  console.log(`[next_audio_output] Default playback → ${name}`)
  return name
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  run().catch((error) => {
    console.error(
      "[next_audio_output]",
      error instanceof Error ? error.message : error,
    )
    process.exitCode = 1
  })
}
