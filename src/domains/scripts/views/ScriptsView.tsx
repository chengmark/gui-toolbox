import { useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { PageHeader } from "@/shared"
import { useI18n } from "@/shared/i18n"
import { DeleteScriptDialog } from "@/domains/scripts/components/DeleteScriptDialog"
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

  if (editorReady) {
    return (
      <div key={`editor:${editor.filename}`} className="view-swipe-in h-full min-h-0">
        <ScriptEditorView
          editor={editor}
          onBack={() => editor.close()}
          onSaved={(entry) => {
            catalog.applySavedScript(entry)
            editor.close()
          }}
        />
      </div>
    )
  }

  return (
    <div key="scripts-list" className="view-fade-in flex h-full min-h-0 flex-col">
      <PageHeader
        title={t("scripts.title")}
        description={
          opening ? t("scripts.opening") : t("scripts.description")
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {catalog.loading ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
            {t("scripts.loading")}
          </div>
        ) : catalog.loadError ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-destructive">
            {catalog.loadError}
          </div>
        ) : catalog.scripts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
            {t("scripts.empty")}
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
