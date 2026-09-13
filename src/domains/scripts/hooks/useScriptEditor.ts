import { useCallback, useEffect, useMemo, useState } from "react"
import { defaultArgsFor } from "@/domains/scripts/command-schema"
import {
  createEmptyInlineSubroutine,
  createEmptyProcessSubroutine,
  createEmptyStep,
  formatArgsInput,
  normalizeCommand,
  normalizeScriptDocument,
  normalizeSteps,
  type ScriptDocument,
  type ScriptSectionKey,
  type ScriptStep,
  type ScriptSubroutine,
} from "@/domains/scripts/model"

function cloneDocument(doc: ScriptDocument): ScriptDocument {
  return structuredClone(doc)
}

export function useScriptEditor(filename: string | null) {
  const [openFilename, setOpenFilename] = useState<string | null>(filename)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<ScriptDocument | null>(null)
  const [draft, setDraft] = useState<ScriptDocument | null>(null)

  useEffect(() => {
    setOpenFilename(filename)
  }, [filename])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!openFilename) {
        setDraft(null)
        setBaseline(null)
        setError(null)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const { content } = await window.scriptsApi.read(openFilename)
        if (cancelled) return
        const doc = normalizeScriptDocument(
          content,
          openFilename.replace(/\.json$/i, ""),
        )
        setDraft(cloneDocument(doc))
        setBaseline(cloneDocument(doc))
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to open script")
        setDraft(null)
        setBaseline(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [openFilename])

  const dirty = useMemo(() => {
    if (!draft || !baseline) return false
    return JSON.stringify(draft) !== JSON.stringify(baseline)
  }, [draft, baseline])

  const updateMeta = useCallback((key: "name" | "toggle", value: string) => {
    setDraft((current) => {
      if (!current) return current
      if (key === "name") {
        return { ...current, name: value }
      }
      const next = { ...current }
      if (value.trim()) next.toggle = value.trim()
      else delete next.toggle
      return next
    })
  }, [])

  const getSectionSteps = useCallback(
    (section: ScriptSectionKey): ScriptStep[] => {
      if (!draft) return []
      return normalizeSteps(draft[section])
    },
    [draft],
  )

  const setSectionSteps = useCallback((section: ScriptSectionKey, steps: ScriptStep[]) => {
    setDraft((current) => {
      if (!current) return current
      const next = { ...current }
      if (steps.length) next[section] = steps
      else delete next[section]
      return next
    })
  }, [])

  const addStep = useCallback(
    (section: ScriptSectionKey) => {
      setSectionSteps(section, [...getSectionSteps(section), createEmptyStep()])
    },
    [getSectionSteps, setSectionSteps],
  )

  const insertStep = useCallback(
    (section: ScriptSectionKey, afterIndex: number) => {
      const steps = [...getSectionSteps(section)]
      const insertAt = Math.min(Math.max(afterIndex + 1, 0), steps.length)
      steps.splice(insertAt, 0, createEmptyStep())
      setSectionSteps(section, steps)
    },
    [getSectionSteps, setSectionSteps],
  )

  const updateStep = useCallback(
    (section: ScriptSectionKey, index: number, patch: Partial<ScriptStep>) => {
      const steps = getSectionSteps(section).map((step, i) => {
        if (i !== index) return step
        if (patch.command && patch.command !== step.command && patch.args === undefined) {
          const command = normalizeCommand(patch.command)
          return { command, args: defaultArgsFor(command) }
        }
        return {
          ...step,
          ...patch,
          command: patch.command ? normalizeCommand(patch.command) : step.command,
        }
      })
      setSectionSteps(section, steps)
    },
    [getSectionSteps, setSectionSteps],
  )

  const updateStepArgs = useCallback(
    (section: ScriptSectionKey, index: number, args: unknown[]) => {
      updateStep(section, index, { args })
    },
    [updateStep],
  )

  const removeStep = useCallback(
    (section: ScriptSectionKey, index: number) => {
      setSectionSteps(
        section,
        getSectionSteps(section).filter((_, i) => i !== index),
      )
    },
    [getSectionSteps, setSectionSteps],
  )

  const moveStep = useCallback(
    (section: ScriptSectionKey, index: number, direction: -1 | 1) => {
      const steps = [...getSectionSteps(section)]
      const target = index + direction
      if (target < 0 || target >= steps.length) return
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      setSectionSteps(section, steps)
    },
    [getSectionSteps, setSectionSteps],
  )

  const subroutines = draft?.subroutines ?? []

  const setSubroutines = useCallback((next: ScriptSubroutine[]) => {
    setDraft((current) => {
      if (!current) return current
      const doc = { ...current }
      if (next.length) doc.subroutines = next
      else delete doc.subroutines
      return doc
    })
  }, [])

  const addProcessSubroutine = useCallback(() => {
    setSubroutines([...subroutines, createEmptyProcessSubroutine()])
  }, [setSubroutines, subroutines])

  const addInlineSubroutine = useCallback(() => {
    setSubroutines([...subroutines, createEmptyInlineSubroutine()])
  }, [setSubroutines, subroutines])

  const updateSubroutine = useCallback(
    (index: number, next: ScriptSubroutine) => {
      setSubroutines(subroutines.map((item, i) => (i === index ? next : item)))
    },
    [setSubroutines, subroutines],
  )

  const removeSubroutine = useCallback(
    (index: number) => {
      setSubroutines(subroutines.filter((_, i) => i !== index))
    },
    [setSubroutines, subroutines],
  )

  const save = useCallback(async () => {
    if (!openFilename || !draft) return null

    const content = normalizeScriptDocument(
      draft as unknown as Record<string, unknown>,
      openFilename.replace(/\.json$/i, ""),
    )

    try {
      setSaving(true)
      setError(null)
      const saved = await window.scriptsApi.write(openFilename, content)
      setDraft(cloneDocument(content))
      setBaseline(cloneDocument(content))
      return saved
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save script")
      return null
    } finally {
      setSaving(false)
    }
  }, [draft, openFilename])

  const close = useCallback(() => {
    setOpenFilename(null)
  }, [])

  return {
    filename: openFilename,
    loading,
    saving,
    error,
    dirty,
    draft,
    updateMeta,
    getSectionSteps,
    addStep,
    insertStep,
    updateStep,
    updateStepArgs,
    removeStep,
    moveStep,
    subroutines,
    addProcessSubroutine,
    addInlineSubroutine,
    updateSubroutine,
    removeSubroutine,
    formatArgsInput,
    save,
    close,
    open: setOpenFilename,
  }
}

export type ScriptEditorState = ReturnType<typeof useScriptEditor>
