import { useCallback, useEffect, useRef, useState } from "react"
import {
  formatKeybind,
  keybindFromKeyboardEvent,
  keybindFromModifierKeyup,
  keybindFromMouseEvent,
  normalizeKeybind,
} from "@/shared/keybind/model"

export type UseKeybindRecordingOptions = {
  enabled?: boolean
  /** Called when a binding is successfully recorded. */
  onRecord: (value: string) => void
  /** Called when recording is cancelled via Escape. */
  onCancel?: () => void
}

export type UseKeybindRecordingResult = {
  recording: boolean
  start: () => void
  stop: () => void
  toggle: () => void
}

function hasGlobalMouseRecorder(): boolean {
  return typeof window !== "undefined" && window.keybindRecorderApi != null
}

/**
 * Shared keybind recording logic: keyboard chords, mouse buttons, Escape to cancel.
 * Completes on the first non-modifier key or mouse button (with held modifiers).
 * Lone modifiers commit on keyup when no other modifiers remain held.
 *
 * Mouse: prefers main-process uiohook for clicks outside the app window (MB1–MB5),
 * and uses DOM mousedown for in-window clicks so the Record button is ignored.
 */
export function useKeybindRecording({
  enabled = true,
  onRecord,
  onCancel,
}: UseKeybindRecordingOptions): UseKeybindRecordingResult {
  const [recording, setRecording] = useState(false)
  const sawPrimaryRef = useRef(false)
  const onRecordRef = useRef(onRecord)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onRecordRef.current = onRecord
  }, [onRecord])

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  const stop = useCallback(() => {
    setRecording(false)
    sawPrimaryRef.current = false
    void window.keybindRecorderApi?.stop()
  }, [])

  const start = useCallback(() => {
    if (!enabled) return
    sawPrimaryRef.current = false
    setRecording(true)
  }, [enabled])

  const toggle = useCallback(() => {
    if (recording) stop()
    else start()
  }, [recording, start, stop])

  useEffect(() => {
    if (!recording) return

    let done = false

    const commit = (raw: string) => {
      if (done) return
      const next = normalizeKeybind(raw)
      if (!next) return
      done = true
      onRecordRef.current(next)
      sawPrimaryRef.current = false
      setRecording(false)
      void window.keybindRecorderApi?.stop()
    }

    const cancel = () => {
      if (done) return
      done = true
      onCancelRef.current?.()
      sawPrimaryRef.current = false
      setRecording(false)
      void window.keybindRecorderApi?.stop()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === "Escape") {
        cancel()
        return
      }

      const parts = keybindFromKeyboardEvent(event)
      if (!parts) return
      sawPrimaryRef.current = true
      commit(formatKeybind(parts))
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (sawPrimaryRef.current) return
      if (event.key === "Escape") return

      const parts = keybindFromModifierKeyup(event)
      if (!parts) return
      commit(formatKeybind(parts))
    }

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-keybind-record]")) return

      event.preventDefault()
      event.stopPropagation()

      const parts = keybindFromMouseEvent(event)
      if (!parts) return
      sawPrimaryRef.current = true
      commit(formatKeybind(parts))
    }

    const onContextMenu = (event: MouseEvent) => {
      // Keep MB2 from opening the Electron/Chromium context menu mid-record.
      event.preventDefault()
      event.stopPropagation()
    }

    const onAuxClick = (event: MouseEvent) => {
      // Middle/side buttons: some environments deliver auxclick more reliably.
      const target = event.target as HTMLElement | null
      if (target?.closest("[data-keybind-record]")) return
      if (event.button === 0) return

      event.preventDefault()
      event.stopPropagation()

      const parts = keybindFromMouseEvent(event)
      if (!parts) return
      sawPrimaryRef.current = true
      commit(formatKeybind(parts))
    }

    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("keyup", onKeyUp, true)
    window.addEventListener("mousedown", onMouseDown, true)
    window.addEventListener("auxclick", onAuxClick, true)
    window.addEventListener("contextmenu", onContextMenu, true)

    const api = hasGlobalMouseRecorder() ? window.keybindRecorderApi : null
    let offResult: (() => void) | undefined
    let offCancel: (() => void) | undefined
    if (api) {
      void api.start()
      offResult = api.onResult((bind) => {
        sawPrimaryRef.current = true
        commit(bind)
      })
      offCancel = api.onCancel(() => {
        cancel()
      })
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("keyup", onKeyUp, true)
      window.removeEventListener("mousedown", onMouseDown, true)
      window.removeEventListener("auxclick", onAuxClick, true)
      window.removeEventListener("contextmenu", onContextMenu, true)
      offResult?.()
      offCancel?.()
      void api?.stop()
    }
  }, [recording])

  useEffect(() => {
    if (!enabled && recording) stop()
  }, [enabled, recording, stop])

  return { recording, start, stop, toggle }
}
