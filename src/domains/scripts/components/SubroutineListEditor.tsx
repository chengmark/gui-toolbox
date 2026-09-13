import { Trash2 } from "lucide-react"
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
import { StepListEditor } from "@/domains/scripts/components/StepListEditor"
import { defaultArgsFor } from "@/domains/scripts/command-schema"
import {
  createEmptyStep,
  formatArgsInput,
  normalizeCommand,
  parseArgsInput,
  type InlineSubroutine,
  type ScriptStep,
  type ScriptSubroutine,
} from "@/domains/scripts/model"

type SubroutineListEditorProps = {
  subroutines: ScriptSubroutine[]
  onUpdate: (index: number, next: ScriptSubroutine) => void
  onRemove: (index: number) => void
}

function withInlineSteps(
  item: InlineSubroutine,
  key: "initial" | "loop",
  nextSteps: ScriptStep[],
): InlineSubroutine {
  const next: InlineSubroutine = { kind: "inline", id: item.id }
  const initial = key === "initial" ? nextSteps : (item.initial ?? [])
  const loop = key === "loop" ? nextSteps : (item.loop ?? [])
  if (initial.length) next.initial = initial
  if (loop.length) next.loop = loop
  return next
}

function InlineStepsEditor({
  title,
  steps,
  onChange,
}: {
  title: string
  steps: ScriptStep[]
  onChange: (steps: ScriptStep[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] leading-4 font-medium text-muted-foreground">{title}</p>
      <StepListEditor
        nested
        steps={steps}
        onAdd={() => onChange([...steps, createEmptyStep()])}
        onInsert={(afterIndex) => {
          const next = [...steps]
          next.splice(afterIndex + 1, 0, createEmptyStep())
          onChange(next)
        }}
        onUpdateCommand={(index, command) =>
          onChange(
            steps.map((step, i) => {
              if (i !== index) return step
              const next = normalizeCommand(command)
              return { command: next, args: defaultArgsFor(next) }
            }),
          )
        }
        onUpdateArgs={(index, args) =>
          onChange(
            steps.map((step, i) => (i === index ? { ...step, args } : step)),
          )
        }
        onMove={(index, direction) => {
          const next = [...steps]
          const target = index + direction
          if (target < 0 || target >= next.length) return
          ;[next[index], next[target]] = [next[target], next[index]]
          onChange(next)
        }}
        onRemove={(index) => onChange(steps.filter((_, i) => i !== index))}
      />
    </div>
  )
}

export function SubroutineListEditor({
  subroutines,
  onUpdate,
  onRemove,
}: SubroutineListEditorProps) {
  return (
    <div className="space-y-3">
      {subroutines.map((item, index) => (
        <div
          key={`${item.kind}-${index}`}
          className="space-y-3 rounded-xl border border-white/8 bg-[#202020] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Select
              value={item.kind}
              onValueChange={(value) => {
                if (value === "process") {
                  onUpdate(index, { kind: "process", file: "", args: [] })
                }
                if (value === "inline") {
                  onUpdate(index, { kind: "inline", id: "subroutine" })
                }
              }}
            >
              <SelectTrigger size="sm" className="h-9 w-40 rounded-lg border-white/8 bg-[#222]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="process">process</SelectItem>
                <SelectItem value="inline">inline</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          {item.kind === "process" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] leading-none text-muted-foreground">
                  File
                </Label>
                <Input
                  value={item.file}
                  spellCheck={false}
                  className="h-8 font-mono text-[12px] leading-none"
                  placeholder="limit_download.mjs"
                  onChange={(event) =>
                    onUpdate(index, {
                      kind: "process",
                      file: event.target.value,
                      args: item.args ?? [],
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] leading-none text-muted-foreground">
                  Args (JSON)
                </Label>
                <Input
                  value={formatArgsInput(item.args ?? [])}
                  spellCheck={false}
                  className="h-8 font-mono text-[12px] leading-none"
                  onBlur={(event) =>
                    onUpdate(index, {
                      kind: "process",
                      file: item.file,
                      args: parseArgsInput(event.target.value),
                    })
                  }
                  onChange={(event) =>
                    onUpdate(index, {
                      kind: "process",
                      file: item.file,
                      args: parseArgsInput(event.target.value),
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[11px] leading-none text-muted-foreground">
                  Id
                </Label>
                <Input
                  value={item.id}
                  spellCheck={false}
                  className="h-8 font-mono text-[12px] leading-none"
                  onChange={(event) =>
                    onUpdate(index, {
                      kind: "inline",
                      id: event.target.value,
                      ...(item.initial?.length ? { initial: item.initial } : {}),
                      ...(item.loop?.length ? { loop: item.loop } : {}),
                    })
                  }
                />
              </div>
              <InlineStepsEditor
                title="Initial"
                steps={item.initial ?? []}
                onChange={(steps) =>
                  onUpdate(index, withInlineSteps(item, "initial", steps))
                }
              />
              <InlineStepsEditor
                title="Loop"
                steps={item.loop ?? []}
                onChange={(steps) =>
                  onUpdate(index, withInlineSteps(item, "loop", steps))
                }
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
