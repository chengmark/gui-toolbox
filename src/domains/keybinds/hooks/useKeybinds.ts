import { useCallback, useEffect, useState } from "react"
import { useDebouncedCallback } from "@/shared/hooks/useDebouncedCallback"
import {
  EMPTY_KEYBINDS_STATE,
  type KeybindEntry,
  type KeybindsState,
} from "@/domains/keybinds/model"

export function useKeybinds() {
  const [state, setState] = useState<KeybindsState>(EMPTY_KEYBINDS_STATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function load() {
      try {
        setLoading(true)
        setActionError(null)
        const next = await window.keybindsApi.getState()
        if (cancelled) return
        setState(next)
        unsubscribe = window.keybindsApi.onState((live) => {
          setState(live)
        })
      } catch (error) {
        if (cancelled) return
        setActionError(
          error instanceof Error ? error.message : "Failed to load keybinds",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const runMutation = useCallback(async (action: () => Promise<KeybindsState>) => {
    try {
      setSaving(true)
      setActionError(null)
      const next = await action()
      setState(next)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to sync keybind.json",
      )
    } finally {
      setSaving(false)
    }
  }, [])

  const updateEntryDebounced = useDebouncedCallback(
    (id: string, patch: Partial<KeybindEntry>) => {
      void runMutation(() => window.keybindsApi.update(id, patch))
    },
    350,
  )

  const addEntry = useCallback(() => {
    void runMutation(() => window.keybindsApi.create())
  }, [runMutation])

  const updateEntry = useCallback(
    (
      id: string,
      patch: Partial<KeybindEntry>,
      options?: { debounce?: boolean },
    ) => {
      setState((current) => ({
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry,
        ),
      }))
      if (options?.debounce) updateEntryDebounced(id, patch)
      else void runMutation(() => window.keybindsApi.update(id, patch))
    },
    [runMutation, updateEntryDebounced],
  )

  const removeEntry = useCallback(
    (id: string) => {
      void runMutation(() => window.keybindsApi.remove(id))
    },
    [runMutation],
  )

  const refreshScripts = useCallback(async () => {
    try {
      setActionError(null)
      const next = await window.keybindsApi.refreshScripts()
      setState(next)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to refresh scripts",
      )
    }
  }, [])

  return {
    state,
    loading,
    saving,
    actionError,
    addEntry,
    updateEntry,
    removeEntry,
    refreshScripts,
  }
}
