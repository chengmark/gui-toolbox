export type ScriptStep = {
  command: string
  args: unknown[]
}

export type InlineSubroutine = {
  kind: 'inline'
  id: string
  initial: ScriptStep[]
  loop: ScriptStep[]
}

export type ProcessSubroutine = {
  kind: 'process'
  file: string
  args: unknown[]
}

export type ScriptDocument = {
  name: string
  toggle: string
  initial: ScriptStep[]
  loop: ScriptStep[]
  background: ScriptStep[]
  subroutines: Array<InlineSubroutine | ProcessSubroutine>
}

export type RunnerStatus = {
  /** Idle = unloaded; Active = loaded waiting; Running = executing */
  state: 'idle' | 'active' | 'running'
  filename: string | null
  running: boolean
  loaded: boolean
  error: string | null
  lastMessage: string | null
}

export type RunnerContext = {
  running: boolean
  exiting: boolean
  scriptBaseDir: string
  inlineScripts: Map<string, InlineSubroutine>
}
