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
