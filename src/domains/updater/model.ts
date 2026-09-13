export type UpdaterPhase =
  | "idle"
  | "available"
  | "downloading"
  | "ready"
  | "error"

export type UpdaterPromptState = {
  phase: UpdaterPhase
  currentVersion: string
  newVersion: string
  percent: number
  errorMessage: string | null
}

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "skipped"
  | "error"
  | "unsupported"

export type UpdaterInfo = {
  status: UpdaterStatus
  currentVersion: string
  latestVersion: string | null
  message: string | null
  checking: boolean
}
