import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/** Provider options for the agentic code-gen runner. Extensible. */
export type AgentProvider =
  | 'claude' // Anthropic API direct
  | 'claude-bedrock' // Amazon Bedrock
  | 'claude-vertex'; // Google Vertex AI

export interface AgentSettings {
  provider: AgentProvider;
  model: string;
  apiKey: string; // stored server-side only; never returned to the UI
}

/** UI-safe view — the key is masked, never sent to the browser. */
export interface AgentSettingsPublic {
  provider: AgentProvider;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string | null; // last 4 chars, for recognition
}

const DEFAULTS: AgentSettings = {
  provider: 'claude',
  model: 'claude-sonnet-4-6',
  apiKey: '',
};

// Gitignored — holds the API key in plaintext on the dev machine only.
const SETTINGS_FILE = path.join(process.cwd(), 'agent-settings.json');

/**
 * K-00 — stores the agentic code-gen configuration (provider · model · API key).
 * The key is persisted server-side and exposed to the runner via `getApiKey()`,
 * but the controller only ever returns the masked `AgentSettingsPublic` to the UI.
 */
@Injectable()
export class AgentSettingsService {
  private readonly logger = new Logger(AgentSettingsService.name);

  private read(): AgentSettings {
    let base: AgentSettings = { ...DEFAULTS };
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        base = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
      }
    } catch (err) {
      this.logger.warn('Failed to read agent-settings.json, using defaults', err);
    }
    // Env fallback for the key whenever the file doesn't carry one, so a key in
    // .env (ANTHROPIC_API_KEY) is reflected everywhere — incl. the UI status.
    if (!base.apiKey) base.apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    return base;
  }

  /** Full settings incl. key — server-side only (used by the runner). */
  getSettings(): AgentSettings {
    return this.read();
  }

  /** Resolve the API key (file → env fallback). */
  getApiKey(): string {
    return this.read().apiKey || process.env.ANTHROPIC_API_KEY || '';
  }

  /** UI-safe view with the key masked. */
  getPublic(): AgentSettingsPublic {
    const s = this.read();
    return {
      provider: s.provider,
      model: s.model,
      apiKeySet: Boolean(s.apiKey),
      apiKeyHint: s.apiKey ? `…${s.apiKey.slice(-4)}` : null,
    };
  }

  /** Update settings. An omitted/blank apiKey leaves the existing key intact. */
  update(updates: Partial<AgentSettings>): AgentSettingsPublic {
    const current = this.read();
    const merged: AgentSettings = {
      provider: updates.provider ?? current.provider,
      model: updates.model ?? current.model,
      // Only overwrite the key when a non-blank value is supplied.
      apiKey: updates.apiKey && updates.apiKey.trim() ? updates.apiKey.trim() : current.apiKey,
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    this.logger.log(`Agent settings updated: provider=${merged.provider} model=${merged.model}`);
    return this.getPublic();
  }
}
