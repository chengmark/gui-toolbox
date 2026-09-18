import { useState, type AnimationEvent } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react"
import { PageHeader } from "@/shared"
import { useI18n } from "@/shared/i18n"
import { Button } from "@/shared/ui/button"
import { DeleteScriptDialog } from "@/domains/scripts/components/DeleteScriptDialog"
import { ScriptsFolderBar } from "@/domains/scripts/components/ScriptsFolderBar"
import {
  ScriptRow,
  type ScriptRunState,
} from "@/domains/scripts/components/ScriptRow"
import { useScriptEditor } from "@/domains/scripts/hooks/useScriptEditor"
import { useScriptsCatalog } from "@/domains/scripts/hooks/useScriptsCatalog"
import { ScriptEditorView } from "@/domains/scripts/views/ScriptEditorView"
import { withFavoritesFirst, type ScriptItem } from "@/domains/scripts/model"
import { cn } from "@/shared/lib/utils"

type SortKey = "name" | "filename" | "toggle" | "status"
type SortDir = "asc" | "desc"

type SortState = { key: SortKey; dir: SortDir } | null

const STATUS_RANK: Record<ScriptRunState, number> = {
  idle: 0,
  active: 1,
  running: 2,
}

function compareScripts(
  a: ScriptItem,
  b: ScriptItem,
  sort: SortState,
  getRunState: (filename: string) => ScriptRunState,
): number {
  if (!sort) return 0
  const mul = sort.dir === "asc" ? 1 : -1
  let cmp = 0
  if (sort.key === "name") {
    cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  } else if (sort.key === "filename") {
    cmp = a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" })
  } else if (sort.key === "toggle") {
    cmp = (a.toggle ?? "").localeCompare(b.toggle ?? "", undefined, {
      sensitivity: "base",
    })
  } else {
    cmp = STATUS_RANK[getRunState(a.filename)] - STATUS_RANK[getRunState(b.filename)]
  }
  if (cmp === 0) {
    cmp = a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" })
  }
  return cmp * mul
}

function SortableTh({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string
  column: SortKey
  sort: SortState
  onSort: (column: SortKey) => void
  className?: string
}) {
  const active = sort?.key === column
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown

  return (
    <th className={cn("px-2 py-2 font-medium whitespace-nowrap", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-[11px] uppercase tracking-wide",
          "text-muted-foreground transition-colors hover:text-foreground",
          "[&_svg]:size-3 [&_svg]:shrink-0",
          active && "text-foreground",
        )}
        onClick={() => onSort(column)}
        aria-sort={
          active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        <Icon size={12} strokeWidth={2} aria-hidden />
      </button>
    </th>
  )
}

export function ScriptsView() {
  const { t } = useI18n()
  const catalog = useScriptsCatalog()
  const editor = useScriptEditor(null)
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" })
  const [editorLeaving, setEditorLeaving] = useState(false)

  const editorReady =
    editor.filename !== null && !editor.loading && (editor.draft !== null || editor.error !== null)
  const opening = editor.filename !== null && editor.loading

  const sorted = [...catalog.scripts].sort((a, b) =>
    compareScripts(a, b, sort, catalog.getRunState),
  )
  const sortedScripts = withFavoritesFirst(sorted, catalog.favorites)

  function toggleSort(column: SortKey) {
    setSort((current) => {
      if (!current || current.key !== column) return { key: column, dir: "asc" }
      if (current.dir === "asc") return { key: column, dir: "desc" }
      return null
    })
  }

  async function onAddScript() {
    const created = await catalog.create(t("scripts.newScriptName"))
    if (created) editor.open(created.filename)
  }

  function requestEditorClose() {
    if (editorLeaving) return
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) {
      editor.close()
      return
    }
    setEditorLeaving(true)
  }

  function onEditorTransitionEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (!editorLeaving) return
    editor.close()
    setEditorLeaving(false)
  }

  if (editorReady) {
    return (
      <div
        key={`editor:${editor.filename}`}
        className={cn(
          "h-full min-h-0",
          editorLeaving ? "view-swipe-out" : "view-swipe-in",
        )}
        onAnimationEnd={onEditorTransitionEnd}
      >
        <ScriptEditorView
          editor={editor}
          onBack={requestEditorClose}
          onSaved={(entry) => {
            catalog.applySavedScript(entry)
          }}
        />
      </div>
    )
  }

  return (
    <div key="scripts-list" className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t("scripts.title")}
        description={
          opening ? t("scripts.opening") : t("scripts.description")
        }
      />

      <ScriptsFolderBar onFolderChanged={() => catalog.reload()} />

      {(catalog.actionError || catalog.runnerError) && (
        <div className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
          {catalog.actionError ?? catalog.runnerError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {catalog.loading ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
            {t("scripts.loading")}
          </div>
        ) : catalog.loadError ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-destructive">
            {catalog.loadError}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-4 py-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void onAddScript()}
              >
                <Plus className="size-3.5" />
                {t("scripts.addScript")}
              </Button>
            </div>

            {catalog.scripts.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-[12px] text-muted-foreground">{t("scripts.empty")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void onAddScript()}
                >
                  <Plus className="size-3.5" />
                  {t("scripts.addScript")}
                </Button>
              </div>
            ) : (
              <div className="cursor-scroll min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse">
                  <colgroup>
                    <col className="w-14" />
                    <col />
                    <col className="w-full" />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-sidebar">
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-center font-medium whitespace-nowrap">#</th>
                      <SortableTh label={t("scripts.colName")} column="name" sort={sort} onSort={toggleSort} />
                      <SortableTh
                        label={t("scripts.colFilename")}
                        column="filename"
                        sort={sort}
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label={t("scripts.colToggle")}
                        column="toggle"
                        sort={sort}
                        onSort={toggleSort}
                        className="px-3"
                      />
                      <SortableTh
                        label={t("scripts.colStatus")}
                        column="status"
                        sort={sort}
                        onSort={toggleSort}
                        className="px-3"
                      />
                      <th
                        className="px-3 py-2 font-medium whitespace-nowrap"
                        aria-label={t("common.actions")}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedScripts.map((script, index) => (
                      <ScriptRow
                        key={script.id}
                        index={index + 1}
                        filename={script.filename}
                        name={script.name}
                        toggle={script.toggle}
                        favorite={catalog.isFavorite(script.filename)}
                        runState={catalog.getRunState(script.filename)}
                        onNameChange={catalog.updateName}
                        onFilenameChange={catalog.rename}
                        onToggleFavorite={catalog.toggleFavorite}
                        onToggleLoaded={catalog.toggleActive}
                        onEdit={(filename) => editor.open(filename)}
                        onRequestDelete={catalog.requestDelete}
                        error={catalog.rowErrors[script.filename] ?? null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <DeleteScriptDialog
        pending={catalog.pendingDelete}
        deleting={catalog.deleting}
        onOpenChange={(open) => {
          if (!open) catalog.cancelDelete()
        }}
        onCancel={catalog.cancelDelete}
        onConfirm={() => void catalog.confirmDelete()}
      />
    </div>
  )
}
