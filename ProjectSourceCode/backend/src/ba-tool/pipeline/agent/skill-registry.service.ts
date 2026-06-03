import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SkillDef {
  id: string; // "prd" | "dev"
  label: string;
  description: string;
  /** Whether this skill needs a target subtask (e.g. /dev). */
  needsSubtask: boolean;
}

interface LoadedSkill extends SkillDef {
  body: string; // instruction markdown (frontmatter stripped)
}

/**
 * K-02 — registry of UI-invokable agent skills. Reuses the EXISTING `/prd` and
 * `/dev` skill markdown (the project copies in `Screen-FRD-EPICS-Automation-Skills/`,
 * with a fallback to the user-level `~/.claude/commands/`). Adding a new skill =
 * drop a markdown file + one registry entry — no code change to the runner.
 */
@Injectable()
export class SkillRegistry {
  private readonly logger = new Logger(SkillRegistry.name);

  // Candidate locations for each skill's markdown, in priority order.
  private readonly catalogue: Array<SkillDef & { files: string[] }> = [
    {
      id: 'prd',
      label: '/prd — Sprint PRD',
      description: 'Brainstorm requirements and create sprints/vN/PRD.md + TASKS.md grounded in .context/',
      needsSubtask: false,
      files: [
        this.repoSkill('prd.md'),
        this.userCommand('prd.md'),
      ],
    },
    {
      id: 'dev',
      label: '/dev — Implement Task',
      description: 'Pick the highest-priority task and implement it (TDD, security scan), evolving the scaffolded pseudo files',
      needsSubtask: true,
      files: [
        this.repoSkill('dev.md'),
        this.userCommand('dev.md'),
      ],
    },
  ];

  /** Repo root is four levels up from the compiled backend (dist/src/ba-tool/pipeline/agent). */
  private repoSkill(name: string): string {
    return path.resolve(
      __dirname,
      '..', '..', '..', '..', '..', '..',
      'Screen-FRD-EPICS-Automation-Skills',
      name,
    );
  }

  private userCommand(name: string): string {
    return path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude', 'commands', name);
  }

  /** List skills available for the UI (those whose markdown is resolvable). */
  async list(): Promise<SkillDef[]> {
    const out: SkillDef[] = [];
    for (const s of this.catalogue) {
      if (await this.firstExisting(s.files)) {
        out.push({ id: s.id, label: s.label, description: s.description, needsSubtask: s.needsSubtask });
      }
    }
    return out;
  }

  /** Load a skill's instruction body (frontmatter stripped). */
  async load(skillId: string): Promise<LoadedSkill> {
    const entry = this.catalogue.find((s) => s.id === skillId);
    if (!entry) throw new NotFoundException(`Unknown skill "${skillId}"`);
    const file = await this.firstExisting(entry.files);
    if (!file) {
      throw new NotFoundException(`Skill markdown for "${skillId}" not found in any known location`);
    }
    const raw = await fs.readFile(file, 'utf8');
    return {
      id: entry.id,
      label: entry.label,
      description: entry.description,
      needsSubtask: entry.needsSubtask,
      body: this.stripFrontmatter(raw),
    };
  }

  private async firstExisting(files: string[]): Promise<string | null> {
    for (const f of files) {
      try {
        await fs.access(f);
        return f;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  private stripFrontmatter(md: string): string {
    if (md.startsWith('---')) {
      const end = md.indexOf('\n---', 3);
      if (end !== -1) return md.slice(md.indexOf('\n', end + 1) + 1).trim();
    }
    return md.trim();
  }
}
