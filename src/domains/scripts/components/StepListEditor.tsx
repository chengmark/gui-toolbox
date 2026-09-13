import { useEffect, useState } from "react"
import { ArrowRight, BetweenHorizontalStart, Plus, Trash2, X } from "lucide-react"
import { useI18n } from "@/shared/i18n"
import { cn } from "@/shared/lib/utils"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip"
import { CommandIcon, COMMAND_ICON_SIZE } from "@/domains/scripts/components/command-icons"
import { KeybindRecorder } from "@/domains/scripts/components/KeybindRecorder"
import {
  briefStepDescription,
  getCommandSchema,
  setArgValue,
  validateStepArgs,
  type CommandArgField,
} from "@/domains/scripts/command-schema"
import { SCRIPT_COMMANDS, type ScriptStep } from "@/domains/scripts/model"

type StepListEditorProps = {
  steps: ScriptStep[]
  nested?: boolean
  onAdd: () => void
  onInsert: (afterIndex: number) => void
  onUpdateCommand: (index: number, command: string) => void
  onUpdateArgs: (index: number, args: unknown[]) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
}

function ArgEditor({
  field,
  value,
  error,
  onChange,
}: {
  field: CommandArgField
  value: unknown
  error?: string
  onChange: (raw: string) => void
}) {
  const { t } = useI18n()
  const text = value == null ? "" : String(value)
  const invalid = Boolean(error)

  if (field.type === "keybind") {
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] leading-none text-muted-foreground">
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        <KeybindRecorder
          value={text}
          placeholder={field.placeholder}
          invalid={invalid}
          variant="editor"
          onChange={onChange}
        />
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>
    )
  }

  if (field.type === "mouseButton" || field.type === "select") {
    const options = field.options ?? []
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] leading-none text-muted-foreground">
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        <Select value={text || undefined} onValueChange={(next) => onChange(next ?? "")}>
          <SelectTrigger
            size="sm"
            className={cn(
              "h-9 w-full rounded-md border-white/10 bg-[#1a1a1a]",
              invalid && "border-destructive",
            )}
          >
            <SelectValue placeholder={field.placeholder ?? t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] leading-none text-muted-foreground">
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={text}
        spellCheck={false}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        className={cn(
          "h-9 rounded-md border-white/10 bg-[#1a1a1a] text-[12px]",
          invalid && "border-destructive",
        )}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}

function mouseButtonFor(step: ScriptStep): string | undefined {
  if (step.command === "MouseClick") return String(step.args[0] ?? "left")
  if (step.command === "ClickOn") return String(step.args[2] ?? "left")
  return undefined
}

export function StepListEditor({
  steps,
  nested = false,
  onAdd,
  onInsert,
  onUpdateCommand,
  onUpdateArgs,
  onMove,
  onRemove,
}: StepListEditorProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<number | null>(null)
  const selectedStep = selected != null ? steps[selected] : null
  const schema = selectedStep ? getCommandSchema(selectedStep.command) : null
  const validation = selectedStep ? validateStepArgs(selectedStep) : null
  const commands =
    selectedStep &&
    (SCRIPT_COMMANDS.includes(selectedStep.command as (typeof SCRIPT_COMMANDS)[number])
      ? [...SCRIPT_COMMANDS]
      : [...SCRIPT_COMMANDS, selectedStep.command])

  useEffect(() => {
    if (selected == null) return
    if (selected >= steps.length) {
      setSelected(steps.length ? steps.length - 1 : null)
    }
  }, [steps.length, selected])

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-start gap-3",
          nested && "rounded-lg border border-white/8 bg-black/30 p-2",
        )}
      >
      {/* Primary — left: wrapping step list (stays inside, never covers secondary) */}
      <div
        className="min-w-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a]"
        style={{ minHeight: 'stretch' }}
      >
        <div
          className="flex flex-wrap content-start items-start gap-3 px-3 py-3"
          style={{ minHeight: 'stretch' }}
        >
          {steps.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">{t("scripts.noActionsYet")}</p>
          ) : (
            steps.map((step, index) => {
              const invalid = !validateStepArgs(step).valid
              const isSelected = selected === index

              return (
                <div
                  key={`${index}-${step.command}`}
                  className="step-flow-unit flex shrink-0 items-center gap-2"
                >
                  <div
                    className={cn(
                      "step-token flex shrink-0 flex-col overflow-hidden rounded-lg",
                      isSelected && "is-selected",
                      invalid && "is-invalid",
                    )}
                    style={{ width: 148, height: 132 }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((current) => (current === index ? null : index))
                      }
                      className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 px-2 pt-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0078d4]/60"
                    >
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-md border text-white",
                          isSelected
                            ? "border-[#0078d4]/70 bg-[#1a3a56]"
                            : "border-white/10 bg-[#242424]",
                          invalid && "border-destructive/60 text-destructive",
                        )}
                      >
                        <CommandIcon
                          command={step.command}
                          button={mouseButtonFor(step)}
                          className="size-5"
                        />
                      </span>
                      <span className="flex w-full flex-col items-center justify-center gap-1">
                        <span className="w-full truncate text-[12px] leading-none font-medium text-foreground">
                          {step.command}
                        </span>
                        <span
                          className={cn(
                            "line-clamp-2 w-full text-[11px] leading-snug",
                            invalid ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {briefStepDescription(step)}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center justify-center gap-1 border-t border-white/8 px-1 py-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:bg-white/8 hover:text-foreground"
                            aria-label={t("scripts.insertAfterAria", { step: index + 1 })}
                            onClick={() => {
                              onInsert(index)
                              setSelected(index + 1)
                            }}
                          >
                            <BetweenHorizontalStart className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          {t("scripts.insertAfter")}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            aria-label={t("scripts.deleteStepAria", { step: index + 1 })}
                            onClick={() => {
                              const nextIndex =
                                selected == null
                                  ? null
                                  : selected === index
                                    ? null
                                    : selected > index
                                      ? selected - 1
                                      : selected
                              onRemove(index)
                              setSelected(nextIndex)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          {t("common.delete")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <span
                    className="step-flow-arrow"
                    aria-hidden
                    title={
                      index < steps.length - 1
                        ? t("scripts.thenStep", { step: index + 2 })
                        : t("scripts.thenAddEnd")
                    }
                  >
                    <ArrowRight className="size-5" strokeWidth={2} />
                  </span>
                </div>
              )
            })
          )}

          <button
            type="button"
            aria-label={t("scripts.addAction")}
            onClick={() => {
              onAdd()
              setSelected(steps.length)
            }}
            className="step-token-add flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4]/70"
            style={{ width: 148, height: 132 }}
          >
            <Plus className="size-5" strokeWidth={1.75} />
            <span className="text-[10px] leading-none">{t("scripts.add")}</span>
          </button>
        </div>
      </div>

      {/* Secondary — right: fixed frame so selection doesn't resize layout */}
      <div
        className={cn(
          "box-border flex shrink-0 flex-col overflow-hidden rounded-lg border p-4",
          selectedStep
            ? "border-[#0078d4]/40 bg-[#121820] shadow-[inset_0_1px_0_rgba(0,120,212,0.15)]"
            : "border-dashed border-white/12 bg-[#141414]",
        )}
        style={{ width: 320, height: 'stretch', flexShrink: 0 }}
      >
        {selectedStep && schema && validation && commands && selected != null ? (
          <>
            <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#0078d4]/35 bg-[#1a2a3a] text-white">
                  <CommandIcon
                    command={selectedStep.command}
                    button={mouseButtonFor(selectedStep)}
                    className={COMMAND_ICON_SIZE}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] tracking-wide text-sky-300/80 uppercase">
                    {t("scripts.editAction", { step: selected + 1 })}
                  </div>
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {selectedStep.command}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={selected === 0}
                  onClick={() => {
                    onMove(selected, -1)
                    setSelected(Math.max(0, selected - 1))
                  }}
                >
                  {t("scripts.moveEarlier")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={selected === steps.length - 1}
                  onClick={() => {
                    onMove(selected, 1)
                    setSelected(Math.min(steps.length - 1, selected + 1))
                  }}
                >
                  {t("scripts.moveLater")}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("scripts.closeEditor")}
                  onClick={() => setSelected(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  {t("scripts.commandLabel")}
                </Label>
                <Select
                  value={selectedStep.command}
                  onValueChange={(value) => {
                    if (!value) return
                    onUpdateCommand(selected, value)
                  }}
                >
                  <SelectTrigger className="h-9 w-full rounded-md border-white/10 bg-[#1a1a1a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commands.map((command) => (
                      <SelectItem key={command} value={command}>
                        <span className="flex items-center gap-2">
                          <CommandIcon command={command} className="size-4" />
                          {command}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{schema.summary}</p>
              </div>

              {schema.args.map((field) => (
                <ArgEditor
                  key={field.key}
                  field={field}
                  value={selectedStep.args[field.index]}
                  error={validation.errors[field.key]}
                  onChange={(raw) => {
                    onUpdateArgs(
                      selected,
                      setArgValue(selectedStep.command, selectedStep.args, field, raw),
                    )
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-[12px] text-muted-foreground">
              {t("scripts.selectActionHint")}
            </p>
          </div>
        )}
      </div>
      </div>
    </TooltipProvider>
  )
}
