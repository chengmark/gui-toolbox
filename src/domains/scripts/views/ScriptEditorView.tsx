import { ArrowLeft, Plus } from "lucide-react"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { useI18n, type MessageKey } from "@/shared/i18n"
import { EditorCollapsibleSection } from "@/domains/scripts/components/EditorCollapsibleSection"
import { KeybindRecorder } from "@/domains/scripts/components/KeybindRecorder"
import { StepListEditor } from "@/domains/scripts/components/StepListEditor"
import { SubroutineListEditor } from "@/domains/scripts/components/SubroutineListEditor"
import type { ScriptEditorState } from "@/domains/scripts/hooks/useScriptEditor"
import type { ScriptSectionKey } from "@/domains/scripts/model"

type ScriptEditorViewProps = {
  editor: ScriptEditorState
  onBack: () => void
  onSaved: (entry: ScriptEntry) => void
}

const STEP_SECTIONS: Array<{
  key: ScriptSectionKey
  titleKey: MessageKey
  descriptionKey: MessageKey
  tone: "initial" | "loop" | "background"
}> = [
  {
    key: "initial",
    titleKey: "scripts.sectionInitial",
    descriptionKey: "scripts.sectionInitialDesc",
    tone: "initial",
  },
  {
    key: "loop",
    titleKey: "scripts.sectionLoop",
    descriptionKey: "scripts.sectionLoopDesc",
    tone: "loop",
  },
  {
    key: "background",
    titleKey: "scripts.sectionBackground",
    descriptionKey: "scripts.sectionBackgroundDesc",
    tone: "background",
  },
]

export function ScriptEditorView({ editor, onBack, onSaved }: ScriptEditorViewProps) {
  const { t } = useI18n()
  const hasSubroutines = editor.subroutines.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#121212]">
      <header className="shrink-0 border-b border-white/6 bg-[#161616]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="editor-back-btn rounded-full"
            disabled={editor.saving}
            onClick={onBack}
            aria-label={t("scripts.editorBack")}
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[16px] leading-5 font-semibold tracking-tight text-foreground">
                {editor.draft?.name || t("scripts.title")}
              </h1>
              {editor.dirty ? (
                <Badge variant="outline" className="rounded-full border-amber-500/30 text-amber-300">
                  {t("scripts.editorUnsaved")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full">
                  {t("scripts.editorReady")}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {editor.filename}
              {editor.draft?.toggle
                ? ` · ${t("scripts.profileToggle")} ${editor.draft.toggle}`
                : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              disabled={editor.saving}
              onClick={onBack}
            >
              {t("scripts.editorCancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full px-4"
              disabled={editor.saving || editor.loading || !editor.draft}
              onClick={() => {
                void editor.save().then((saved) => {
                  if (saved) {
                    onSaved(saved)
                    onBack()
                  }
                })
              }}
            >
              {editor.saving ? t("scripts.editorSaving") : t("scripts.editorSave")}
            </Button>
          </div>
        </div>
      </header>

      <div className="cursor-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div
          className="mx-auto max-w-6xl px-4"
          style={{ paddingTop: 20, paddingBottom: 20 }}
        >
          {editor.loading ? (
            <div className="flex h-40 items-center justify-center text-[12px] leading-4 text-muted-foreground">
              {t("scripts.editorLoading")}
            </div>
          ) : editor.error && !editor.draft ? (
            <div className="flex h-40 items-center justify-center text-[12px] leading-4 text-destructive">
              {editor.error}
            </div>
          ) : editor.draft ? (
            <div className="editor-section-stack">
              <EditorCollapsibleSection
                title={t("scripts.profileTitle")}
                description={t("scripts.profileDescription")}
                tone="profile"
                defaultOpen
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="script-name"
                      className="text-[11px] leading-none text-muted-foreground"
                    >
                      {t("scripts.profileName")}
                    </Label>
                    <Input
                      id="script-name"
                      className="h-9 rounded-lg border-white/8 bg-[#222] text-[13px]"
                      value={editor.draft.name}
                      onChange={(event) =>
                        editor.updateMeta("name", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] leading-none text-muted-foreground">
                      {t("scripts.profileToggle")}
                    </Label>
                    <KeybindRecorder
                      value={editor.draft.toggle ?? ""}
                      placeholder="home"
                      variant="editor"
                      onChange={(value) => editor.updateMeta("toggle", value)}
                    />
                  </div>
                </div>
              </EditorCollapsibleSection>

              {STEP_SECTIONS.map((section) => {
                const steps = editor.getSectionSteps(section.key)
                const present = steps.length > 0

                return (
                  <EditorCollapsibleSection
                    key={section.key}
                    title={t(section.titleKey)}
                    description={t(section.descriptionKey)}
                    tone={section.tone}
                    defaultOpen={present}
                    badge={
                      <Badge
                        variant={present ? "secondary" : "outline"}
                        className="rounded-full"
                      >
                        {present
                          ? t("scripts.actionsCount", { count: steps.length })
                          : t("scripts.off")}
                      </Badge>
                    }
                    actions={
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => editor.addStep(section.key)}
                      >
                        <Plus className="size-3.5" />
                        {present ? t("scripts.addAction") : t("scripts.enable")}
                      </Button>
                    }
                  >
                    {present ? (
                      <StepListEditor
                        steps={steps}
                        onAdd={() => editor.addStep(section.key)}
                        onInsert={(afterIndex) =>
                          editor.insertStep(section.key, afterIndex)
                        }
                        onUpdateCommand={(index, command) =>
                          editor.updateStep(section.key, index, { command })
                        }
                        onUpdateArgs={(index, args) =>
                          editor.updateStepArgs(section.key, index, args)
                        }
                        onMove={(index, direction) =>
                          editor.moveStep(section.key, index, direction)
                        }
                        onRemove={(index) =>
                          editor.removeStep(section.key, index)
                        }
                      />
                    ) : null}
                  </EditorCollapsibleSection>
                )
              })}

              <EditorCollapsibleSection
                title={t("scripts.sectionSubroutines")}
                description={t("scripts.sectionSubroutinesDesc")}
                tone="subroutines"
                defaultOpen={hasSubroutines}
                badge={
                  <Badge
                    variant={hasSubroutines ? "secondary" : "outline"}
                    className="rounded-full"
                  >
                    {hasSubroutines
                      ? t("scripts.itemsCount", { count: editor.subroutines.length })
                      : t("scripts.off")}
                  </Badge>
                }
                actions={
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={editor.addProcessSubroutine}
                    >
                      <Plus className="size-3.5" />
                      {t("scripts.addProcess")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={editor.addInlineSubroutine}
                    >
                      <Plus className="size-3.5" />
                      {t("scripts.addInline")}
                    </Button>
                  </>
                }
              >
                {hasSubroutines ? (
                  <SubroutineListEditor
                    subroutines={editor.subroutines}
                    onUpdate={editor.updateSubroutine}
                    onRemove={editor.removeSubroutine}
                  />
                ) : null}
              </EditorCollapsibleSection>
            </div>
          ) : null}
        </div>
      </div>

      {editor.error && editor.draft ? (
        <div className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-[12px] leading-4 text-destructive">
          {editor.error}
        </div>
      ) : null}
    </div>
  )
}
