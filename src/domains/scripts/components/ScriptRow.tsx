import { useEffect, useRef, useState } from "react"
import { Pencil, Pause, Play, Star, Trash2 } from "lucide-react"
import { InlineEditCell, useDebouncedCallback } from "@/shared"
import { useI18n } from "@/shared/i18n"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"

export type ScriptRunState = "idle" | "active" | "running"

type ScriptRowProps = {
  index: number
  filename: string
  name: string
  toggle?: string
  favorite: boolean
  runState: ScriptRunState
  onNameChange: (filename: string, name: string) => void
  onFilenameChange: (filename: string, nextFilename: string) => void
  onToggleFavorite: (filename: string) => void
  onToggleLoaded: (filename: string) => void
  onEdit: (filename: string) => void
  onRequestDelete: (filename: string, name: string) => void
  error?: string | null
}

function statusVariant(
  state: ScriptRunState,
): "secondary" | "success" | "running" {
  if (state === "running") return "running"
  if (state === "active") return "success"
  return "secondary"
}

export function ScriptRow({
  index,
  filename,
  name,
  toggle,
  favorite,
  runState,
  onNameChange,
  onFilenameChange,
  onToggleFavorite,
  onToggleLoaded,
  onEdit,
  onRequestDelete,
  error,
}: ScriptRowProps) {
  const { t } = useI18n()
  const [localName, setLocalName] = useState(name)
  const [localFilename, setLocalFilename] = useState(filename)
  const filenameRef = useRef(filename)
  const loaded = runState !== "idle"
  const toggleBind = toggle?.trim() || ""

  useEffect(() => {
    setLocalName(name)
  }, [name])

  useEffect(() => {
    setLocalFilename(filename)
    filenameRef.current = filename
  }, [filename])

  const syncName = useDebouncedCallback((value: string) => {
    onNameChange(filenameRef.current, value)
  }, 200)

  const syncFilename = useDebouncedCallback((value: string) => {
    onFilenameChange(filenameRef.current, value)
  }, 300)

  const statusText =
    runState === "running"
      ? t("scripts.statusRunning")
      : runState === "active"
        ? t("scripts.statusActive")
        : t("scripts.statusIdle")

  return (
    <tr className="script-row border-b border-border">
      <td className="px-4 py-2 text-center align-middle text-[12px] leading-none tabular-nums text-muted-foreground">
        {index}
      </td>
      <td className="px-2 py-2 align-middle whitespace-nowrap">
        <InlineEditCell
          value={localName}
          ariaLabel={t("scripts.colName")}
          onChange={(value) => {
            setLocalName(value)
            syncName(value)
          }}
          className="text-[13px]"
        />
      </td>
      <td className="w-full px-2 py-2 align-middle whitespace-nowrap">
        <InlineEditCell
          value={localFilename}
          ariaLabel={t("scripts.colFilename")}
          spellCheck={false}
          invalid={Boolean(error)}
          onChange={(value) => {
            setLocalFilename(value)
            syncFilename(value)
          }}
          className="font-mono text-[12px]"
        />
        {error ? (
          <div className="px-2 pt-1 text-[11px] whitespace-nowrap text-destructive">
            {error}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        {toggleBind ? (
          <span className="font-mono text-[12px] text-foreground">{toggleBind}</span>
        ) : (
          <span className="text-[12px] text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        <Badge variant={statusVariant(runState)}>{statusText}</Badge>
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={favorite ? t("scripts.favoriteRemove") : t("scripts.favoriteAdd")}
            aria-label={
              favorite ? t("scripts.favoriteRemove") : t("scripts.favoriteAdd")
            }
            aria-pressed={favorite}
            onClick={() => onToggleFavorite(filename)}
            className={cn("script-row-action", favorite && "is-favorite")}
          >
            <Star className="size-3.5 fill-current" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={loaded ? t("scripts.unloadScript") : t("scripts.loadScript")}
            aria-label={
              loaded ? t("scripts.unloadScript") : t("scripts.loadScript")
            }
            onClick={() => onToggleLoaded(filename)}
            className={cn(
              "script-row-action",
              loaded && "is-active text-success",
              runState === "running" && "text-primary",
            )}
          >
            {loaded ? (
              <Pause className="size-3.5 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={t("scripts.editScript")}
            aria-label={t("scripts.editScript")}
            onClick={() => onEdit(filename)}
            className="script-row-action"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={t("scripts.deleteScript")}
            aria-label={t("scripts.deleteScript")}
            onClick={() => onRequestDelete(filename, localName)}
            className="script-row-action is-danger"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
