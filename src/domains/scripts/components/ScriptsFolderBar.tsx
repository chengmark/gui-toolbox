import { useEffect, useState } from "react"
import { FolderOpen, RotateCcw } from "lucide-react"
import { useI18n } from "@/shared/i18n"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

type ScriptsFolderBarProps = {
  onFolderChanged: () => void | Promise<void>
}

export function ScriptsFolderBar({ onFolderChanged }: ScriptsFolderBarProps) {
  const { t } = useI18n()
  const [info, setInfo] = useState<ScriptsDirInfo | null>(null)
  const [draftPath, setDraftPath] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.scriptsApi.getDir().then((next) => {
      if (cancelled) return
      setInfo(next)
      setDraftPath(next.folderPath)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function applyInfo(next: ScriptsDirInfo) {
    setInfo(next)
    setDraftPath(next.folderPath)
    setError(null)
    await onFolderChanged()
  }

  async function onBrowse() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await window.scriptsApi.chooseDir()
      if (next) await applyInfo(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scripts.folderError"))
    } finally {
      setBusy(false)
    }
  }

  async function onApply() {
    if (busy) return
    const next = draftPath.trim()
    if (!next) {
      setError(t("scripts.folderEmpty"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const info = await window.scriptsApi.setDir(next)
      await applyInfo(info)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scripts.folderError"))
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await window.scriptsApi.resetDir()
      await applyInfo(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scripts.folderError"))
    } finally {
      setBusy(false)
    }
  }

  const dirty = info != null && draftPath.trim() !== info.folderPath

  return (
    <div className="shrink-0 border-b border-border px-4 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="scripts-folder-path" className="text-[12px]">
          {t("scripts.folderLabel")}
        </Label>
        <Input
          id="scripts-folder-path"
          value={draftPath}
          spellCheck={false}
          disabled={busy || info == null}
          className="h-9 font-mono text-[12px]"
          onChange={(event) => setDraftPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void onApply()
          }}
        />
        {info?.isCustom ? (
          <p className="text-[11px] text-muted-foreground">
            {t("scripts.folderCustomHint", { path: info.defaultPath })}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {t("scripts.folderDefaultHint")}
          </p>
        )}
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || info == null}
          onClick={() => void onBrowse()}
        >
          <FolderOpen className="size-3.5" />
          {t("scripts.folderBrowse")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => void onApply()}
        >
          {t("scripts.folderApply")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || info == null || !info.isCustom}
          onClick={() => void onReset()}
        >
          <RotateCcw className="size-3.5" />
          {t("scripts.folderReset")}
        </Button>
      </div>
    </div>
  )
}
