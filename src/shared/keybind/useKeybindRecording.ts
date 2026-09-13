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

/**
 * Shared keybind recording logic: keyboard chords, mouse buttons, Escape to cancel.
 * Completes on the first non-modifier key or mouse button (with held modifiers).
 * Lone modifiers commit on keyup when no other modifiers remain held.
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

    const commit = (raw: string) => {
      const next = normalizeKeybind(raw)
      if (!next) return
      onRecordRef.current(next)
      sawPrimaryRef.current = false
      setRecording(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === "Escape") {
        onCancelRef.current?.()
        sawPrimaryRef.current = false
        setRecording(false)
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

    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("keyup", onKeyUp, true)
    window.addEventListener("mousedown", onMouseDown, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("keyup", onKeyUp, true)
      window.removeEventListener("mousedown", onMouseDown, true)
    }
  }, [recording])

  useEffect(() => {
    if (!enabled && recording) stop()
  }, [enabled, recording, stop])

  return { recording, start, stop, toggle }
}
