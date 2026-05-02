/**
 * Pre/post checklists for SKILL-01-S — FRD generation from screens.
 *
 * Pre: verify SKILL-00 (Screen Analysis) is APPROVED, screens exist,
 *      module status is at least ANALYSIS_COMPLETE, backend + AI service
 *      are reachable, and there's no concurrent live SKILL-01-S exec.
 * Post: verify the latest SKILL-01-S execution did NOT fail, the FRD
 *       artifact has feature blocks, every distinct F-XX-XX has a
 *       canonical `#### F-XX-XX:` heading block, every block carries
 *       all 9 mandatory attributes, the handoff packet parses, and
 *       RTM rows got seeded.
 */
import { Check, distinctMatches, loadModuleContext, probeAiService, probeBackend, NO_ORPHAN_EXECUTIONS_CHECK } from './lib';

const NINE_ATTRIBUTES: { name: string; pattern: RegExp }[] = [
  { name: 'Description', pattern: /\*?\*?\s*(?:Feature\s+)?Description\s*\*?\*?\s*[:\-]/i },
  { name: 'Screen Reference', pattern: /\*?\*?\s*Screen\s*Reference\s*\*?\*?\s*[:\-]/i },
  { name: 'Trigger', pattern: /\*?\*?\s*Trigger\s*\*?\*?\s*[:\-]/i },
  { name: 'Pre-Conditions', pattern: /\*?\*?\s*Pre[-\s]*conditions?\s*\*?\*?\s*[:\-]/i },
  { name: 'Post-Conditions', pattern: /\*?\*?\s*Post[-\s]*conditions?\s*\*?\*?\s*[:\-]/i },
  { name: 'Business Rules', pattern: /\*?\*?\s*Business\s*Rules?\s*\*?\*?\s*[:\-]/i },
  { name: 'Validations', pattern: /\*?\*?\s*Validations?\s*\*?\*?\s*[:\-]/i },
  { name: 'Integration Signals', pattern: /\*?\*?\s*Integration\s*Signals?\s*\*?\*?\s*[:\-]/i },
  { name: 'Acceptance Criteria', pattern: /\*?\*?\s*Acceptance\s*Criteria\s*\*?\*?\s*[:\-]/i },
];

export const PRE_CHECKS: Check[] = [
  {
    name: 'Module exists',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      return { ok: !!mod, detail: mod ? `${mod.moduleId} (${mod.moduleName})` : 'not found' };
    },
  },
  {
    name: 'Module has uploaded screens',
    async run({ prisma, moduleDbId }) {
      const count = await prisma.baScreen.count({ where: { moduleDbId } });
      return { ok: count > 0, detail: `${count} screen(s)` };
    },
  },
  {
    name: 'SKILL-00 (Screen Analysis) latest is APPROVED',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-00' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no SKILL-00 execution' };
      return { ok: exec.status === 'APPROVED', detail: `status=${exec.status}` };
    },
  },
  {
    name: 'SCREEN_ANALYSIS artifact exists with content',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'SCREEN_ANALYSIS' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: false, detail: 'no artifact' };
      return { ok: art._count.sections > 0, detail: `${art._count.sections} sections` };
    },
  },
  {
    name: 'Module status >= ANALYSIS_COMPLETE',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      const order = ['DRAFT', 'SCREENS_UPLOADED', 'ANALYSIS_COMPLETE', 'FRD_COMPLETE', 'EPICS_COMPLETE', 'STORIES_COMPLETE', 'SUBTASKS_COMPLETE', 'APPROVED'];
      const idx = mod ? order.indexOf(mod.moduleStatus) : -1;
      const required = order.indexOf('ANALYSIS_COMPLETE');
      return { ok: idx >= required, detail: mod ? `status=${mod.moduleStatus}` : 'no module' };
    },
  },
  {
    name: 'Backend reachable',
    async run({ apiBase }) {
      return probeBackend(apiBase);
    },
  },
  {
    name: 'AI service reachable',
    async run() {
      return probeAiService();
    },
  },
  {
    name: 'No concurrent live SKILL-01-S execution',
    async run({ prisma, moduleDbId }) {
      const live = await prisma.baSkillExecution.count({
        where: { moduleDbId, skillName: 'SKILL-01-S', status: { in: ['PENDING', 'RUNNING'] } },
      });
      return { ok: live === 0, detail: live > 0 ? `${live} still running` : 'none' };
    },
  },
];

export const POST_CHECKS: Check[] = [
  {
    name: 'SKILL-01-S latest execution is AWAITING_REVIEW or APPROVED (not FAILED)',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-01-S' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      const ok = exec.status === 'AWAITING_REVIEW' || exec.status === 'APPROVED';
      return { ok, detail: `status=${exec.status}${exec.errorMessage ? ` err=${exec.errorMessage.slice(0, 100)}` : ''}` };
    },
  },
  {
    name: 'humanDocument is non-trivial (>= 2KB)',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-01-S' },
        orderBy: { createdAt: 'desc' },
      });
      const len = exec?.humanDocument?.length ?? 0;
      return { ok: len >= 2000, detail: `${len} chars` };
    },
  },
  {
    name: 'FRD artifact created with sections',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FRD' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: false, detail: 'no artifact' };
      return { ok: art._count.sections > 0, detail: `${art._count.sections} sections` };
    },
  },
  {
    name: 'FRD content has at least one F-XX-XX feature ID',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FRD' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const ids = distinctMatches(full, /\bF-\d{2,}-\d{2,}\b/g);
      return { ok: ids.size > 0, detail: `${ids.size} distinct ids${ids.size > 0 ? ` (${[...ids].sort().slice(0, 5).join(', ')}${ids.size > 5 ? ', ...' : ''})` : ''}` };
    },
  },
  {
    name: 'Every feature ID has a canonical "#### F-XX-XX:" heading block',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FRD' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const ids = distinctMatches(full, /\bF-\d{2,}-\d{2,}\b/g);
      if (ids.size === 0) return { ok: false, detail: 'no feature ids to check' };
      const missing: string[] = [];
      for (const id of ids) {
        const re = new RegExp(`^#{1,4}\\s+\\*?\\*?\\s*${id}\\b`, 'm');
        if (!re.test(full)) missing.push(id);
      }
      return { ok: missing.length === 0, detail: missing.length === 0 ? `${ids.size}/${ids.size}` : `missing blocks for: ${missing.join(', ')}` };
    },
  },
  {
    name: 'Every feature block has all 9 mandatory attributes',
    async run({ prisma, moduleDbId }) {
      // Slice the FRD into feature blocks via a line-by-line state machine.
      // The earlier regex-based approach used `\z` (end-of-input) which JS
      // interprets as the literal letter "z", silently truncating any block
      // whose body contained a `z` early on — false-positive missing
      // attributes. The orchestrator's built-in validator uses the same
      // line-by-line shape, so this check now mirrors it exactly.
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FRD' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const lines = full.split('\n');
      const blocks: { id: string; body: string }[] = [];
      let curId: string | null = null;
      let buf: string[] = [];
      const headRe = /^#{1,4}\s+\*?\*?\s*(F-\d+-\d+)/;
      const stopRe = /^#{1,3}\s/;
      const flush = (): void => {
        if (curId) blocks.push({ id: curId, body: buf.join('\n') });
        buf = [];
      };
      for (const line of lines) {
        const h = line.match(headRe);
        if (h) { flush(); curId = h[1]; buf = [line]; continue; }
        if (curId && stopRe.test(line)) { flush(); curId = null; continue; }
        if (curId) buf.push(line);
      }
      flush();
      if (blocks.length === 0) return { ok: false, detail: 'no feature blocks' };
      const incomplete: string[] = [];
      for (const b of blocks) {
        const missing = NINE_ATTRIBUTES.filter((a) => !a.pattern.test(b.body)).map((a) => a.name);
        if (missing.length > 0) incomplete.push(`${b.id}[missing: ${missing.join(', ')}]`);
      }
      return { ok: incomplete.length === 0, detail: incomplete.length === 0 ? `${blocks.length}/${blocks.length} complete` : incomplete.slice(0, 3).join('; ') };
    },
  },
  {
    name: 'Handoff packet JSON is parseable and has features array',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-01-S' },
        orderBy: { createdAt: 'desc' },
      });
      const packet = exec?.handoffPacket as Record<string, unknown> | null;
      if (!packet) return { ok: false, detail: 'no handoffPacket' };
      const features = (packet as { features?: unknown }).features;
      if (!Array.isArray(features)) return { ok: false, detail: 'no features array (or wrong shape)' };
      return { ok: features.length > 0, detail: `${features.length} features in packet` };
    },
  },
  {
    name: 'RTM rows seeded for this module',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      if (!mod || !mod.projectId) return { ok: false, detail: 'no module/project' };
      const count = await prisma.baRtmRow.count({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
      return { ok: count > 0, detail: `${count} rows` };
    },
  },
  NO_ORPHAN_EXECUTIONS_CHECK,
];

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const { runChecks, formatChecklist } = require('./lib');
  const phase = process.argv[2];
  const moduleDbId = process.argv[3];
  if (!phase || !moduleDbId) {
    console.error('Usage: ts-node skill-01-s.ts <pre|post> <moduleDbId>');
    process.exit(2);
  }
  const checks = phase === 'pre' ? PRE_CHECKS : phase === 'post' ? POST_CHECKS : null;
  if (!checks) {
    console.error('phase must be "pre" or "post"');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  const apiBase = process.env.API_BASE ?? 'http://localhost:4000';
  runChecks(checks, { prisma, moduleDbId, apiBase })
    .then((outcome: { allPassed: boolean }) => {
      console.log(formatChecklist(`SKILL-01-S ${phase.toUpperCase()}-CHECKS`, outcome as never));
      return prisma.$disconnect().then(() => process.exit(outcome.allPassed ? 0 : 1));
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(2);
    });
}
