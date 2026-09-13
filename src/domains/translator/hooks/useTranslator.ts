import { useCallback, useEffect, useState } from "react"
import {
  DEFAULT_TRANSLATOR_STATUS,
  type TranslatorKeybindAction,
  type TranslatorSettings,
  type TranslatorStatus,
} from "@/domains/translator/model"

export function useTranslator() {
  const [status, setStatus] = useState<TranslatorStatus>(DEFAULT_TRANSLATOR_STATUS)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function load() {
      try {
        setLoading(true)
        setActionError(null)
        const next = await window.translatorApi.getStatus()
        if (cancelled) return
        setStatus(next)
        unsubscribe = window.translatorApi.onStatus((live) => {
          setStatus(live)
        })
      } catch (error) {
        if (cancelled) return
        setActionError(
          error instanceof Error ? error.message : "Failed to load translator status",
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

  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      setActionError(null)
      const next = await window.translatorApi.setEnabled(enabled)
      setStatus(next)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to update enabled state",
      )
    }
  }, [])

  const updateKeybind = useCallback(
    async (action: TranslatorKeybindAction, value: string) => {
      try {
        setActionError(null)
        const next = await window.translatorApi.updateSettings({ [action]: value })
        setStatus(next)
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Failed to save keybind",
        )
      }
    },
    [],
  )

  const resetSettings = useCallback(async () => {
    try {
      setActionError(null)
      const next = await window.translatorApi.updateSettings({
        copyTrigger: "ctrl+c",
        toggle: "delete",
        fieldConvert: "pagedown",
      } satisfies TranslatorSettings)
      setStatus(next)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to reset keybinds",
      )
    }
  }, [])

  return {
    status,
    loading,
    actionError,
    setEnabled,
    updateKeybind,
    resetSettings,
  }
}
