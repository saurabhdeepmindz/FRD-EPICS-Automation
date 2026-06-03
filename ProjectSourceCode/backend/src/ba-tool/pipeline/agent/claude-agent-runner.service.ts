import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentSettingsService } from '../agent-settings.service';
import type {
  AgentRunner,
  AgentRunRequest,
  AgentEvent,
  AgentRunResult,
  PermissionDecision,
} from './agent-runner.interface';

/** Loose shape of a streamed SDK message — narrowed defensively at runtime. */
interface SdkMessage {
  type?: string;
  subtype?: string;
  sessionId?: string;
  session_id?: string;
  message?: { content?: Array<{ type?: string; text?: string; name?: string; input?: Record<string, unknown> }> };
  [k: string]: unknown;
}

/**
 * K-01 — Claude Agent SDK implementation of the AgentRunner interface.
 * Runs a skill agentically in the project's ProjectSourceCode/ folder, streaming
 * events (logs, tool calls, file edits) and routing tool-permission requests to
 * the caller (the UI, via K-04).
 */
@Injectable()
export class ClaudeAgentRunner implements AgentRunner {
  readonly provider = 'claude';
  private readonly logger = new Logger(ClaudeAgentRunner.name);

  constructor(private readonly settings: AgentSettingsService) {}

  async run(
    req: AgentRunRequest,
    onEvent: (e: AgentEvent) => void,
    resolvePermission?: (requestId: string, tool: string, detail: string) => Promise<PermissionDecision>,
  ): Promise<AgentRunResult> {
    const runId = randomUUID();
    const apiKey = this.settings.getApiKey();
    if (!apiKey) {
      const message = 'No Anthropic API key configured. Set it in Agent Settings (provider · model · key).';
      onEvent({ type: 'error', message });
      return { ok: false, summary: message, filesChanged: [] };
    }
    // The SDK reads the key from env. Set it for this run.
    process.env.ANTHROPIC_API_KEY = apiKey;

    const model = this.settings.getSettings().model;
    const prompt = this.buildPrompt(req);
    const filesChanged: string[] = [];
    let sessionId: string | undefined = req.resumeSessionId;

    onEvent({ type: 'start', runId, sessionId });

    try {
      const stream = query({
        prompt,
        options: {
          cwd: req.cwd,
          model,
          // File edits + reads + bash allowed; each gated by canUseTool below.
          allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
          ...(req.resumeSessionId ? { resume: req.resumeSessionId } : {}),
          // Route every tool request to the UI for approval (K-04). Default-allow
          // when no resolver is wired (e.g. a non-interactive run).
          canUseTool: async (toolName: string, input: Record<string, unknown>) => {
            this.trackFile(toolName, input, filesChanged, onEvent);
            if (!resolvePermission) {
              return { behavior: 'allow', updatedInput: input } as const;
            }
            const requestId = randomUUID();
            const detail = this.describeTool(toolName, input);
            onEvent({ type: 'permission', requestId, tool: toolName, detail });
            const decision = await resolvePermission(requestId, toolName, detail);
            return decision.allow
              ? ({ behavior: 'allow', updatedInput: input } as const)
              : ({ behavior: 'deny', message: decision.message ?? 'Denied in UI' } as const);
          },
        },
      });

      for await (const raw of stream as AsyncIterable<SdkMessage>) {
        sessionId = raw.sessionId ?? raw.session_id ?? sessionId;
        this.emitFromMessage(raw, onEvent);
      }

      const summary = `Run complete (${filesChanged.length} file change(s)).`;
      onEvent({ type: 'result', ok: true, summary });
      return { ok: true, summary, sessionId, filesChanged };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent run failed: ${message}`);
      onEvent({ type: 'error', message });
      return { ok: false, summary: message, sessionId, filesChanged };
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private buildPrompt(req: AgentRunRequest): string {
    const parts = [
      `You are running the "${req.skillName}" skill inside this project's ProjectSourceCode folder.`,
      `Use the upstream context below (the requirements, design, and traceability) to ground your work.`,
      '',
      '## Skill instructions',
      req.skillPrompt,
      '',
      '## Upstream context (.context/)',
      req.contextText.slice(0, 40000),
    ];
    if (req.extraInstruction?.trim()) {
      parts.push('', '## This run', req.extraInstruction.trim());
    }
    return parts.join('\n');
  }

  private emitFromMessage(raw: SdkMessage, onEvent: (e: AgentEvent) => void): void {
    const content = raw.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text?.trim()) {
          onEvent({ type: 'log', text: block.text });
        } else if (block.type === 'tool_use' && block.name) {
          onEvent({ type: 'tool', tool: block.name, summary: this.describeTool(block.name, block.input ?? {}) });
        }
      }
    }
  }

  private trackFile(
    toolName: string,
    input: Record<string, unknown>,
    filesChanged: string[],
    onEvent: (e: AgentEvent) => void,
  ): void {
    if ((toolName === 'Write' || toolName === 'Edit') && typeof input.file_path === 'string') {
      filesChanged.push(input.file_path);
      onEvent({ type: 'file', path: input.file_path, action: toolName === 'Write' ? 'write' : 'edit' });
    }
  }

  private describeTool(toolName: string, input: Record<string, unknown>): string {
    if (typeof input.file_path === 'string') return `${toolName} ${input.file_path}`;
    if (typeof input.command === 'string') return `${toolName}: ${String(input.command).slice(0, 120)}`;
    if (typeof input.pattern === 'string') return `${toolName} ${input.pattern}`;
    return toolName;
  }
}
