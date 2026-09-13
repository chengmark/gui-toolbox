import { useEffect, useState } from "react"
import { FolderOpen, RotateCcw } from "lucide-react"
import { PageHeader } from "@/shared"
import { useAppConfig } from "@/domains/persistence"
import { useI18n, LOCALE_OPTIONS, type Locale } from "@/shared/i18n"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"

type PathInfo = {
  filePath: string
  defaultPath: string
  isCustom: boolean
}

export function SettingsView() {
  const { t, locale, setLocale } = useI18n()
  const { reload } = useAppConfig()
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null)
  const [draftPath, setDraftPath] = useState("")
  const [pathBusy, setPathBusy] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.appConfigApi?.getPath().then((info) => {
      if (cancelled) return
      setPathInfo(info)
      setDraftPath(info.filePath)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function applyPathInfo(info: PathInfo) {
    setPathInfo(info)
    setDraftPath(info.filePath)
    setPathError(null)
    await reload()
  }

  async function onBrowse() {
    if (!window.appConfigApi || pathBusy) return
    setPathBusy(true)
    setPathError(null)
    try {
      const info = await window.appConfigApi.choosePath()
      if (info) await applyPathInfo(info)
    } catch (error) {
      setPathError(error instanceof Error ? error.message : t("settings.pathError"))
    } finally {
      setPathBusy(false)
    }
  }

  async function onApplyPath() {
    if (!window.appConfigApi || pathBusy) return
    const next = draftPath.trim()
    if (!next) {
      setPathError(t("settings.pathEmpty"))
      return
    }
    setPathBusy(true)
    setPathError(null)
    try {
      const info = await window.appConfigApi.setPath(next)
      await applyPathInfo(info)
    } catch (error) {
      setPathError(error instanceof Error ? error.message : t("settings.pathError"))
    } finally {
      setPathBusy(false)
    }
  }

  async function onResetPath() {
    if (!window.appConfigApi || pathBusy) return
    setPathBusy(true)
    setPathError(null)
    try {
      const info = await window.appConfigApi.resetPath()
      await applyPathInfo(info)
    } catch (error) {
      setPathError(error instanceof Error ? error.message : t("settings.pathError"))
    } finally {
      setPathBusy(false)
    }
  }

  const pathDirty = pathInfo != null && draftPath.trim() !== pathInfo.filePath

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground">
              {t("settings.languageTitle")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.languageDescription")}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="settings-language" className="text-[12px]">
              {t("settings.languageLabel")}
            </Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                if (value) setLocale(value as Locale)
              }}
            >
              <SelectTrigger id="settings-language" className="h-9 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.nativeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground">
              {t("settings.pathTitle")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.pathDescription")}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="settings-file-path" className="text-[12px]">
              {t("settings.pathLabel")}
            </Label>
            <Input
              id="settings-file-path"
              value={draftPath}
              spellCheck={false}
              disabled={pathBusy || pathInfo == null}
              className="h-9 font-mono text-[12px]"
              onChange={(event) => setDraftPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void onApplyPath()
              }}
            />
            {pathInfo?.isCustom ? (
              <p className="text-[11px] text-muted-foreground">
                {t("settings.pathCustomHint", { path: pathInfo.defaultPath })}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("settings.pathDefaultHint")}
              </p>
            )}
            {pathError ? (
              <p className="text-[11px] text-destructive">{pathError}</p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pathBusy || pathInfo == null}
              onClick={() => void onBrowse()}
            >
              <FolderOpen className="size-3.5" />
              {t("settings.pathBrowse")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pathBusy || !pathDirty}
              onClick={() => void onApplyPath()}
            >
              {t("settings.pathApply")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pathBusy || pathInfo == null || !pathInfo.isCustom}
              onClick={() => void onResetPath()}
            >
              <RotateCcw className="size-3.5" />
              {t("settings.pathReset")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
