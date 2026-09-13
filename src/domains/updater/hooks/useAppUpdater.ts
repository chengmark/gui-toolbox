import { useEffect, useRef, useState } from "react"
import type { UpdaterPromptState } from "@/domains/updater/model"

const INITIAL: UpdaterPromptState = {
  phase: "idle",
  currentVersion: "",
  newVersion: "",
  percent: 0,
  errorMessage: null,
}

export function useAppUpdater() {
  const [state, setState] = useState<UpdaterPromptState>(INITIAL)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    if (typeof window.updaterApi?.check !== "function") return

    let disposed = false
    const unsubProgress = window.updaterApi.onProgress((progress) => {
      if (disposed) return
      setState((prev) => ({
        ...prev,
        phase: "downloading",
        percent: Math.max(0, Math.min(100, progress.percent)),
      }))
    })
    const unsubDownloaded = window.updaterApi.onDownloaded(() => {
      if (disposed) return
      setState((prev) => ({
        ...prev,
        phase: "ready",
        percent: 100,
        errorMessage: null,
      }))
    })
    const unsubError = window.updaterApi.onError((payload) => {
      if (disposed) return
      setState((prev) => ({
        ...prev,
        phase: "error",
        errorMessage: payload.message,
      }))
    })

    void (async () => {
      try {
        const result = await window.updaterApi.check()
        if (disposed) return
        if (result.status !== "available") return
        setState({
          phase: "available",
          currentVersion: result.currentVersion,
          newVersion: result.newVersion,
          percent: 0,
          errorMessage: null,
        })
      } catch {
        // Startup checks should stay silent on failure.
      }
    })()

    return () => {
      disposed = true
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const dismiss = () => {
    if (state.phase === "downloading") {
      void window.updaterApi.cancelDownload()
    }
    setState(INITIAL)
  }

  const startDownload = () => {
    setState((prev) => ({
      ...prev,
      phase: "downloading",
      percent: 0,
      errorMessage: null,
    }))
    void window.updaterApi.download()
  }

  const install = () => {
    void window.updaterApi.install()
  }

  return {
    state,
    open: state.phase !== "idle",
    dismiss,
    startDownload,
    install,
  }
}
