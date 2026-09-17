import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAppConfig } from "@/domains/persistence"
import type { UpdaterInfo, UpdaterPromptState } from "@/domains/updater/model"

const INITIAL_PROMPT: UpdaterPromptState = {
  phase: "idle",
  currentVersion: "",
  newVersion: "",
  percent: 0,
  errorMessage: null,
}

const INITIAL_INFO: UpdaterInfo = {
  status: "idle",
  currentVersion: "",
  latestVersion: null,
  message: null,
  checking: false,
  lastCheckedAt: null,
}

function checkedNow(): string {
  return new Date().toISOString()
}

type UpdaterContextValue = {
  info: UpdaterInfo
  prompt: UpdaterPromptState
  promptOpen: boolean
  checkNow: () => Promise<void>
  startDownload: () => void
  install: () => void
  dismissPrompt: () => void
  skipVersion: () => Promise<void>
  openUpdatePrompt: () => void
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null)

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const { ready, config, setSkippedUpdateVersion } = useAppConfig()
  const [info, setInfo] = useState<UpdaterInfo>(INITIAL_INFO)
  const [prompt, setPrompt] = useState<UpdaterPromptState>(INITIAL_PROMPT)
  const startupCheckedRef = useRef(false)
  const skippedVersion = config.updates?.skippedVersion ?? null

  useEffect(() => {
    if (typeof window.updaterApi?.getVersion !== "function") return
    let cancelled = false
    void window.updaterApi.getVersion().then((version) => {
      if (cancelled) return
      setInfo((prev) => ({ ...prev, currentVersion: version }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window.updaterApi?.onProgress !== "function") return

    const unsubProgress = window.updaterApi.onProgress((progress) => {
      setPrompt((prev) => ({
        ...prev,
        phase: "downloading",
        percent: Math.max(0, Math.min(100, progress.percent)),
      }))
    })
    const unsubDownloaded = window.updaterApi.onDownloaded(() => {
      setPrompt((prev) => ({
        ...prev,
        phase: "ready",
        percent: 100,
        errorMessage: null,
      }))
    })
    const unsubError = window.updaterApi.onError((payload) => {
      setPrompt((prev) => ({
        ...prev,
        phase: "error",
        errorMessage: payload.message,
      }))
      setInfo((prev) => ({
        ...prev,
        status: "error",
        message: payload.message,
        checking: false,
      }))
    })

    return () => {
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const applyCheckResult = useCallback(
    (
      result: Awaited<ReturnType<typeof window.updaterApi.check>>,
      options: { promptIfAvailable: boolean; respectSkip: boolean },
    ) => {
      const lastCheckedAt = checkedNow()

      if (result.status === "skipped") {
        setInfo((prev) => ({
          ...prev,
          status: "unsupported",
          currentVersion: result.currentVersion,
          latestVersion: null,
          message: result.message,
          checking: false,
          lastCheckedAt,
        }))
        return
      }

      if (result.status === "error") {
        setInfo((prev) => ({
          ...prev,
          status: "error",
          currentVersion: result.currentVersion,
          latestVersion: null,
          message: result.message,
          checking: false,
          lastCheckedAt,
        }))
        return
      }

      if (result.status === "not-available") {
        setInfo((prev) => ({
          ...prev,
          status: "up-to-date",
          currentVersion: result.currentVersion,
          latestVersion: result.newVersion ?? result.currentVersion,
          message: null,
          checking: false,
          lastCheckedAt,
        }))
        return
      }

      const isSkipped =
        options.respectSkip &&
        skippedVersion != null &&
        skippedVersion === result.newVersion

      setInfo((prev) => ({
        ...prev,
        status: isSkipped ? "skipped" : "available",
        currentVersion: result.currentVersion,
        latestVersion: result.newVersion,
        message: null,
        checking: false,
        lastCheckedAt,
      }))

      if (options.promptIfAvailable && !isSkipped) {
        setPrompt({
          phase: "available",
          currentVersion: result.currentVersion,
          newVersion: result.newVersion,
          percent: 0,
          errorMessage: null,
        })
      }
    },
    [skippedVersion],
  )

  const runCheck = useCallback(
    async (options: { promptIfAvailable: boolean; respectSkip: boolean }) => {
      if (typeof window.updaterApi?.check !== "function") return
      setInfo((prev) => ({
        ...prev,
        status: "checking",
        checking: true,
        message: null,
      }))
      try {
        const result = await window.updaterApi.check()
        applyCheckResult(result, options)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to check for updates"
        setInfo((prev) => ({
          ...prev,
          status: "error",
          message,
          checking: false,
          lastCheckedAt: checkedNow(),
        }))
      }
    },
    [applyCheckResult],
  )

  useEffect(() => {
    if (!ready || startupCheckedRef.current) return
    startupCheckedRef.current = true
    void runCheck({ promptIfAvailable: true, respectSkip: true })
  }, [ready, runCheck])

  const checkNow = useCallback(async () => {
    await runCheck({ promptIfAvailable: false, respectSkip: false })
  }, [runCheck])

  const dismissPrompt = useCallback(() => {
    if (prompt.phase === "downloading") {
      void window.updaterApi.cancelDownload()
    }
    setPrompt(INITIAL_PROMPT)
  }, [prompt.phase])

  const skipVersion = useCallback(async () => {
    const version = prompt.newVersion || info.latestVersion
    if (!version) {
      setPrompt(INITIAL_PROMPT)
      return
    }
    if (prompt.phase === "downloading") {
      void window.updaterApi.cancelDownload()
    }
    await setSkippedUpdateVersion(version)
    setInfo((prev) => ({
      ...prev,
      status: "skipped",
      latestVersion: version,
    }))
    setPrompt(INITIAL_PROMPT)
  }, [
    info.latestVersion,
    prompt.newVersion,
    prompt.phase,
    setSkippedUpdateVersion,
  ])

  const startDownload = useCallback(() => {
    const currentVersion = prompt.currentVersion || info.currentVersion
    const newVersion = prompt.newVersion || info.latestVersion || ""
    if (!newVersion) return
    setPrompt({
      phase: "downloading",
      currentVersion,
      newVersion,
      percent: 0,
      errorMessage: null,
    })
    void window.updaterApi.download()
  }, [
    info.currentVersion,
    info.latestVersion,
    prompt.currentVersion,
    prompt.newVersion,
  ])

  const install = useCallback(() => {
    void window.updaterApi.install()
  }, [])

  /** Surface an available update in the status bar (or reopen after dismiss). */
  const openUpdatePrompt = useCallback(() => {
    if (!info.latestVersion) return
    if (prompt.phase === "downloading" || prompt.phase === "ready") return
    setPrompt({
      phase: "available",
      currentVersion: info.currentVersion,
      newVersion: info.latestVersion,
      percent: 0,
      errorMessage: null,
    })
  }, [info.currentVersion, info.latestVersion, prompt.phase])

  const value = useMemo(
    () => ({
      info,
      prompt,
      promptOpen: prompt.phase !== "idle",
      checkNow,
      startDownload,
      install,
      dismissPrompt,
      skipVersion,
      openUpdatePrompt,
    }),
    [
      info,
      prompt,
      checkNow,
      startDownload,
      install,
      dismissPrompt,
      skipVersion,
      openUpdatePrompt,
    ],
  )

  return (
    <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>
  )
}

export function useUpdater(): UpdaterContextValue {
  const ctx = useContext(UpdaterContext)
  if (!ctx) {
    throw new Error("useUpdater must be used within UpdaterProvider")
  }
  return ctx
}
