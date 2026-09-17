import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_APP_CONFIG,
  hydrateAppConfig,
  type AppConfig,
  type AppConfigLocale,
  type AppConfigPatch,
  type CloseAction,
} from "@/domains/persistence/model"

type AppConfigContextValue = {
  ready: boolean
  config: AppConfig
  setLocale: (locale: AppConfigLocale | null) => Promise<void>
  setOpenAtLogin: (enabled: boolean) => Promise<void>
  setCloseAction: (action: CloseAction) => Promise<void>
  setScriptFavorites: (filenames: string[]) => Promise<void>
  setTranslationEnabled: (enabled: boolean) => Promise<void>
  setSkippedUpdateVersion: (skippedVersion: string | null) => Promise<void>
  reload: () => Promise<void>
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null)

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG)

  useEffect(() => {
    let cancelled = false
    void hydrateAppConfig().then((next) => {
      if (cancelled) return
      setConfig(next)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const api = window.appConfigApi
    if (!api?.onUpdated) return
    return api.onUpdated((next) => {
      setConfig(next)
      setReady(true)
    })
  }, [])

  const persist = useCallback(async (patch: AppConfigPatch) => {
    if (!window.appConfigApi) {
      setConfig((current) => ({
        common: { ...current.common, ...patch.common },
        scripts: {
          schemaVersion: 1,
          scriptFavorites:
            patch.scripts?.scriptFavorites ?? current.scripts.scriptFavorites,
          folderPath:
            patch.scripts?.folderPath === undefined
              ? current.scripts.folderPath
              : patch.scripts.folderPath,
        },
        translation: { ...current.translation, ...patch.translation },
        updates: { ...current.updates, ...patch.updates },
      }))
      return
    }
    const next = await window.appConfigApi.patch(patch)
    setConfig(next)
  }, [])

  const setLocale = useCallback(
    async (locale: AppConfigLocale | null) => {
      await persist({ common: { locale } })
    },
    [persist],
  )

  const setOpenAtLogin = useCallback(
    async (enabled: boolean) => {
      await persist({ common: { openAtLogin: enabled } })
    },
    [persist],
  )

  const setCloseAction = useCallback(
    async (action: CloseAction) => {
      await persist({ common: { closeAction: action } })
    },
    [persist],
  )

  const setScriptFavorites = useCallback(
    async (filenames: string[]) => {
      await persist({ scripts: { scriptFavorites: filenames } })
    },
    [persist],
  )

  const setTranslationEnabled = useCallback(
    async (enabled: boolean) => {
      await persist({ translation: { enabled } })
    },
    [persist],
  )

  const setSkippedUpdateVersion = useCallback(
    async (skippedVersion: string | null) => {
      await persist({ updates: { skippedVersion } })
    },
    [persist],
  )

  const reload = useCallback(async () => {
    if (!window.appConfigApi) return
    const next = await window.appConfigApi.get()
    setConfig(next)
  }, [])

  const value = useMemo(
    () => ({
      ready,
      config,
      setLocale,
      setOpenAtLogin,
      setCloseAction,
      setScriptFavorites,
      setTranslationEnabled,
      setSkippedUpdateVersion,
      reload,
    }),
    [
      ready,
      config,
      setLocale,
      setOpenAtLogin,
      setCloseAction,
      setScriptFavorites,
      setTranslationEnabled,
      setSkippedUpdateVersion,
      reload,
    ],
  )

  return (
    <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
  )
}

export function useAppConfig(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext)
  if (!ctx) {
    throw new Error("useAppConfig must be used within AppConfigProvider")
  }
  return ctx
}
