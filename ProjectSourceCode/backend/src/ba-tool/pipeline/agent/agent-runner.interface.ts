/**
 * Provider-agnostic agentic code-gen runner (Track K).
 *
 * The first implementation is `ClaudeAgentRunner` (Claude Agent SDK). Other
 * providers can be added behind this interface later without touching the
 * controller / streaming layer.
 */

export interface AgentRunRequest {
  projectId: string;
  /** Skill id from the registry, e.g. "prd" | "dev". */
  skillName: string;
  /** Absolute path to run in — the project's ProjectSourceCode/ folder. */
  cwd: string;
  /** The skill's instruction body (loaded from its markdown). */
  skillPrompt: string;
  /** Assembled `.context/` grounding text. */
  contextText: string;
  /** Optional extra instruction (e.g. "implement SUBTASK-12"). */
  extraInstruction?: string;
  /** Resume an earlier agent session (long-running runs). */
  resumeSessionId?: string;
}

/** A single streamed event from a run — forwarded to the UI over SSE. */
export type AgentEvent =
  | { type: 'start'; runId: string; sessionId?: string }
  | { type: 'log'; text: string } // assistant narration
  | { type: 'tool'; tool: string; summary: string } // a tool call started
  | { type: 'file'; path: string; action: 'write' | 'edit' } // a file changed
  | { type: 'permission'; requestId: string; tool: string; detail: string } // awaiting UI approval
  // P-01 — per-task lifecycle in a /dev code run (drives the Tasks panel live).
  | { type: 'task'; taskKey: string; sequence: number; status: 'running' | 'completed' | 'failed' | 'skipped'; title?: string; error?: string }
  | { type: 'result'; ok: boolean; summary: string }
  | { type: 'error'; message: string };

export interface AgentRunResult {
  ok: boolean;
  summary: string;
  sessionId?: string;
  filesChanged: string[];
}

/** A pending permission decision the UI must resolve (K-04). */
export interface PermissionDecision {
  allow: boolean;
  message?: string;
}

export interface AgentRunner {
  /** Provider id, e.g. "claude". */
  readonly provider: string;

  /**
   * Run a skill. Emits events via `onEvent` as they happen (logs, tool calls,
   * file changes, permission requests). `resolvePermission` is invoked when the
   * agent needs approval for a tool — the runner awaits the returned promise
   * (K-04 routes this to the UI).
   */
  run(
    req: AgentRunRequest,
    onEvent: (e: AgentEvent) => void,
    resolvePermission?: (requestId: string, tool: string, detail: string) => Promise<PermissionDecision>,
  ): Promise<AgentRunResult>;
}

/** DI token for the active runner implementation. */
export const AGENT_RUNNER = Symbol('AGENT_RUNNER');
