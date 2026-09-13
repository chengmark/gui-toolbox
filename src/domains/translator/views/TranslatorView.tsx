import { PageHeader } from "@/shared"
import { useI18n } from "@/shared/i18n"
import { TranslatorKeybindsPanel } from "@/domains/translator/components/TranslatorKeybindsPanel"
import { TranslatorStatusPanel } from "@/domains/translator/components/TranslatorStatusPanel"
import { useTranslator } from "@/domains/translator/hooks/useTranslator"

export function TranslatorView() {
  const { t } = useI18n()
  const {
    status,
    loading,
    actionError,
    setEnabled,
    updateKeybind,
    resetSettings,
  } = useTranslator()

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("translator.title")}
        description={t("translator.description")}
      />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
            {t("translator.loading")}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {(actionError || status.error) && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                {actionError ?? status.error}
              </div>
            )}

            <TranslatorStatusPanel
              status={status}
              onEnabledChange={(enabled) => {
                void setEnabled(enabled)
              }}
            />

            <TranslatorKeybindsPanel
              settings={status.settings}
              onChange={(action, value) => {
                void updateKeybind(action, value)
              }}
              onReset={() => {
                void resetSettings()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
