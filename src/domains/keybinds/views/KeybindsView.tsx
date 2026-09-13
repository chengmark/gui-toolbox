import { PageHeader } from "@/shared"
import { useI18n } from "@/shared/i18n"
import { Button } from "@/shared/ui/button"
import { KeybindsTable } from "@/domains/keybinds/components/KeybindsTable"
import { useKeybinds } from "@/domains/keybinds/hooks/useKeybinds"

export function KeybindsView() {
  const { t } = useI18n()
  const {
    state,
    loading,
    saving,
    actionError,
    addEntry,
    updateEntry,
    removeEntry,
    refreshScripts,
  } = useKeybinds()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t("keybinds.title")}
        description={t("keybinds.description")}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {(actionError || state.error) && (
          <div className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
            {actionError ?? state.error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
            {t("keybinds.loading")}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span className="min-w-0 truncate" title={state.filePath}>
                {t("keybinds.count", { count: state.entries.length })}
                {` · ${state.filePath}`}
                {state.lastMessage ? ` · ${state.lastMessage}` : ""}
                {saving ? ` · ${t("common.syncing")}` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshScripts()}
              >
                {t("keybinds.refreshScripts")}
              </Button>
            </div>
            <KeybindsTable
              entries={state.entries}
              scripts={state.scripts}
              disabled={saving}
              onAdd={addEntry}
              onUpdate={updateEntry}
              onRemove={removeEntry}
            />
          </>
        )}
      </div>
    </div>
  )
}
