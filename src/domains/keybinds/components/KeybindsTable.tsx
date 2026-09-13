import { Plus, Trash2 } from "lucide-react"
import { KeybindRecorder } from "@/shared/keybind"
import { useI18n } from "@/shared/i18n"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Switch } from "@/shared/ui/switch"
import type { KeybindEntry, KeybindJsScript } from "@/domains/keybinds/model"

type KeybindsTableProps = {
  entries: KeybindEntry[]
  scripts: KeybindJsScript[]
  disabled?: boolean
  onAdd: () => void
  onUpdate: (
    id: string,
    patch: Partial<KeybindEntry>,
    options?: { debounce?: boolean },
  ) => void
  onRemove: (id: string) => void
}

export function KeybindsTable({
  entries,
  scripts,
  disabled = false,
  onAdd,
  onUpdate,
  onRemove,
}: KeybindsTableProps) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-4 py-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus className="size-3.5" />
          {t("keybinds.add")}
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-muted-foreground">
          {t("keybinds.empty")}
        </div>
      ) : (
        <div className="cursor-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <colgroup>
              <col className="w-14" />
              <col className="w-48" />
              <col />
              <col className="w-44" />
              <col className="w-20" />
              <col className="w-16" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-sidebar">
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-center font-medium">#</th>
                <th className="px-2 py-2 font-medium">{t("keybinds.colLabel")}</th>
                <th className="px-2 py-2 font-medium">{t("keybinds.colShortcut")}</th>
                <th className="px-2 py-2 font-medium">{t("keybinds.colScript")}</th>
                <th className="px-2 py-2 text-center font-medium">{t("keybinds.colOn")}</th>
                <th
                  className="px-2 py-2 font-medium"
                  aria-label={t("common.actions")}
                />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const scriptMissing =
                  Boolean(entry.script) &&
                  !scripts.some((script) => script.filename === entry.script)

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border/70 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2 text-center text-[12px] text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={entry.label}
                        disabled={disabled}
                        placeholder={t("common.optional")}
                        className="h-8 text-[12px]"
                        onChange={(event) =>
                          onUpdate(
                            entry.id,
                            { label: event.target.value },
                            { debounce: true },
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <KeybindRecorder
                        value={entry.bind}
                        disabled={disabled}
                        placeholder={t("common.recordShortcut")}
                        onChange={(bind) => onUpdate(entry.id, { bind })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {scripts.length === 0 ? (
                        <Input
                          value={entry.script}
                          disabled={disabled}
                          placeholder={t("keybinds.noScripts")}
                          className={
                            scriptMissing
                              ? "h-8 border-destructive text-[12px]"
                              : "h-8 text-[12px]"
                          }
                          onChange={(event) =>
                            onUpdate(entry.id, { script: event.target.value })
                          }
                        />
                      ) : (
                        <Select
                          value={entry.script || undefined}
                          disabled={disabled}
                          onValueChange={(script) =>
                            onUpdate(entry.id, { script: script ?? "" })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className={
                              scriptMissing ? "h-8 border-destructive" : "h-8"
                            }
                          >
                            <SelectValue placeholder={t("keybinds.selectScript")} />
                          </SelectTrigger>
                          <SelectContent>
                            {scripts.map((script) => (
                              <SelectItem
                                key={script.filename}
                                value={script.filename}
                              >
                                {script.filename}
                              </SelectItem>
                            ))}
                            {scriptMissing && entry.script ? (
                              <SelectItem value={entry.script}>
                                {t("keybinds.missingScript", {
                                  filename: entry.script,
                                })}
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-center">
                        <Switch
                          checked={entry.enabled}
                          disabled={disabled}
                          onCheckedChange={(enabled) =>
                            onUpdate(entry.id, { enabled })
                          }
                          aria-label={t("keybinds.enableAria", {
                            name: entry.label || entry.bind || "keybind",
                          })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled}
                        aria-label={t("keybinds.remove")}
                        onClick={() => onRemove(entry.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
