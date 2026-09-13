import { useCallback, useEffect, useMemo, useState } from "react"
import { useAppConfig } from "@/domains/persistence"
import {
  createScriptId,
  type PendingDelete,
  type ScriptItem,
} from "@/domains/scripts/model"
import type { ScriptRunState } from "@/domains/scripts/components/ScriptRow"

function entryToItem(entry: ScriptEntry): ScriptItem {
  return {
    id: createScriptId(entry.filename),
    filename: entry.filename,
    name: entry.name,
    toggle: entry.toggle,
  }
}

function stateFromStatus(status: ScriptRunnerStatus): {
  loadedFilename: string | null
  runStateByFile: Record<string, ScriptRunState>
} {
  if (!status.filename || status.state === "idle") {
    return { loadedFilename: null, runStateByFile: {} }
  }
  return {
    loadedFilename: status.filename,
    runStateByFile: { [status.filename]: status.state },
  }
}

export function useScriptsCatalog() {
  const { config, setScriptFavorites } = useAppConfig()
  const favorites = useMemo(
    () => new Set(config.scripts.scriptFavorites),
    [config.scripts.scriptFavorites],
  )
  const [scripts, setScripts] = useState<ScriptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null)
  const [runStates, setRunStates] = useState<Record<string, ScriptRunState>>({})
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [runnerError, setRunnerError] = useState<string | null>(null)

  const persistFavorites = useCallback(
    (next: Set<string>) => {
      void setScriptFavorites([...next])
    },
    [setScriptFavorites],
  )

  const applyRunnerStatus = useCallback((status: ScriptRunnerStatus) => {
    const next = stateFromStatus(status)
    setLoadedFilename(next.loadedFilename)
    setRunStates(next.runStateByFile)
    setRunnerError(status.error)
  }, [])

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      setRowErrors({})
      const [entries, status] = await Promise.all([
        window.scriptsApi.list(),
        window.scriptsApi.getRunnerStatus(),
      ])
      setScripts(entries.map(entryToItem))
      applyRunnerStatus(status)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load scripts")
    } finally {
      setLoading(false)
    }
  }, [applyRunnerStatus])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setLoadError(null)
        const [entries, status] = await Promise.all([
          window.scriptsApi.list(),
          window.scriptsApi.getRunnerStatus(),
        ])
        if (cancelled) return
        setScripts(entries.map(entryToItem))
        applyRunnerStatus(status)
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : "Failed to load scripts")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [applyRunnerStatus])

  useEffect(() => {
    return window.scriptsApi.onRunnerStatus((status) => {
      applyRunnerStatus(status)
      if (status.error && status.filename) {
        setRowErrors((current) => ({
          ...current,
          [status.filename!]: status.error ?? "Runner error",
        }))
      }
    })
  }, [applyRunnerStatus])

  const getRunState = useCallback(
    (filename: string): ScriptRunState => runStates[filename] ?? "idle",
    [runStates],
  )

  const isFavorite = useCallback(
    (filename: string) => favorites.has(filename),
    [favorites],
  )

  const toggleFavorite = useCallback(
    (filename: string) => {
      const next = new Set(favorites)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      persistFavorites(next)
    },
    [favorites, persistFavorites],
  )

  const updateName = useCallback(async (filename: string, name: string) => {
    try {
      await window.scriptsApi.updateName(filename, name)
      setScripts((current) =>
        current.map((item) => (item.filename === filename ? { ...item, name } : item)),
      )
      setRowErrors((current) => {
        if (!(filename in current)) return current
        const next = { ...current }
        delete next[filename]
        return next
      })
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [filename]: error instanceof Error ? error.message : "Failed to save name",
      }))
    }
  }, [])

  const applySavedScript = useCallback((entry: ScriptEntry) => {
    setScripts((current) =>
      current.map((item) =>
        item.filename === entry.filename
          ? {
              ...item,
              name: entry.name,
              toggle: entry.toggle,
            }
          : item,
      ),
    )
  }, [])

  const rename = useCallback(
    async (filename: string, nextFilename: string) => {
      try {
        const updated = await window.scriptsApi.rename(filename, nextFilename)
        setScripts((current) =>
          current.map((item) =>
            item.filename === filename
              ? {
                  ...item,
                  id: createScriptId(updated.filename),
                  filename: updated.filename,
                  name: updated.name,
                  toggle: updated.toggle,
                }
              : item,
          ),
        )
        setLoadedFilename((current) =>
          current === filename ? updated.filename : current,
        )
        setRunStates((current) => {
          if (!(filename in current)) return current
          const next = { ...current }
          next[updated.filename] = next[filename]
          delete next[filename]
          return next
        })
        if (favorites.has(filename)) {
          const next = new Set(favorites)
          next.delete(filename)
          next.add(updated.filename)
          persistFavorites(next)
        }
        setRowErrors((current) => {
          const next = { ...current }
          delete next[filename]
          if (updated.filename !== filename) delete next[updated.filename]
          return next
        })
      } catch (error) {
        setRowErrors((current) => ({
          ...current,
          [filename]: error instanceof Error ? error.message : "Failed to rename file",
        }))
      }
    },
    [favorites, persistFavorites],
  )

  /** Play loads (Active); Pause unloads (Idle). Running is via toggle. */
  const toggleActive = useCallback(
    async (filename: string) => {
      try {
        setRunnerError(null)
        const next = loadedFilename === filename ? null : filename
        const status = await window.scriptsApi.setActive(next)
        applyRunnerStatus(status)
        if (status.error) {
          setRowErrors((current) => ({
            ...current,
            [filename]: status.error ?? "Failed to load script",
          }))
        } else {
          setRowErrors((current) => {
            if (!(filename in current)) return current
            const copy = { ...current }
            delete copy[filename]
            return copy
          })
        }
      } catch (error) {
        setRunnerError(error instanceof Error ? error.message : "Failed to load script")
        setRowErrors((current) => ({
          ...current,
          [filename]: error instanceof Error ? error.message : "Failed to load script",
        }))
      }
    },
    [loadedFilename, applyRunnerStatus],
  )

  const requestDelete = useCallback((filename: string, name: string) => {
    setPendingDelete({ filename, name })
  }, [])

  const cancelDelete = useCallback(() => {
    if (!deleting) setPendingDelete(null)
  }, [deleting])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    const { filename } = pendingDelete
    try {
      setDeleting(true)
      if (loadedFilename === filename) {
        await window.scriptsApi.setActive(null)
      }
      await window.scriptsApi.delete(filename)
      setScripts((current) => current.filter((item) => item.filename !== filename))
      setLoadedFilename((current) => (current === filename ? null : current))
      setRunStates((current) => {
        if (!(filename in current)) return current
        const next = { ...current }
        delete next[filename]
        return next
      })
      if (favorites.has(filename)) {
        const next = new Set(favorites)
        next.delete(filename)
        persistFavorites(next)
      }
      setRowErrors((current) => {
        if (!(filename in current)) return current
        const next = { ...current }
        delete next[filename]
        return next
      })
      setPendingDelete(null)
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [filename]: error instanceof Error ? error.message : "Failed to delete script",
      }))
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }, [pendingDelete, loadedFilename, favorites, persistFavorites])

  return {
    scripts,
    loading,
    loadError,
    rowErrors,
    loadedFilename,
    getRunState,
    favorites,
    isFavorite,
    toggleFavorite,
    pendingDelete,
    deleting,
    runnerError,
    reload,
    updateName,
    applySavedScript,
    rename,
    toggleActive,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
