/**
 * Pre/post checklists for SKILL-02-S — EPIC generation from FRD.
 *
 * Pre: SKILL-01-S APPROVED, FRD artifact has feature blocks, module
 *      status >= FRD_COMPLETE, infra reachable.
 * Post: SKILL-02-S not FAILED, EPIC artifact created with sections,
 *       EPIC-NN-NN ids present, every feature has at least one EPIC,
 *       RTM rows have epicId.
 */
import { Check, distinctMatches, probeAiService, probeBackend } from './lib';

export const PRE_CHECKS: Check[] = [
  {
    name: 'SKILL-01-S latest is APPROVED',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-01-S' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      return { ok: exec.status === 'APPROVED', detail: `status=${exec.status}` };
    },
  },
  {
    name: 'FRD artifact has at least one feature ID',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FRD' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const ids = distinctMatches(full, /\bF-\d{2,}-\d{2,}\b/g);
      return { ok: ids.size > 0, detail: `${ids.size} features` };
    },
  },
  {
    name: 'Module status >= FRD_COMPLETE',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      const order = ['DRAFT', 'SCREENS_UPLOADED', 'ANALYSIS_COMPLETE', 'FRD_COMPLETE', 'EPICS_COMPLETE', 'STORIES_COMPLETE', 'SUBTASKS_COMPLETE', 'APPROVED'];
      const idx = mod ? order.indexOf(mod.moduleStatus) : -1;
      const required = order.indexOf('FRD_COMPLETE');
      return { ok: idx >= required, detail: mod ? `status=${mod.moduleStatus}` : 'no module' };
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
    name: 'No concurrent live SKILL-02-S execution',
    async run({ prisma, moduleDbId }) {
      const live = await prisma.baSkillExecution.count({
        where: { moduleDbId, skillName: 'SKILL-02-S', status: { in: ['PENDING', 'RUNNING'] } },
      });
      return { ok: live === 0, detail: live > 0 ? `${live} still running` : 'none' };
    },
  },
];

export const POST_CHECKS: Check[] = [
  {
    name: 'SKILL-02-S latest is AWAITING_REVIEW or APPROVED (not FAILED)',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-02-S' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      const ok = exec.status === 'AWAITING_REVIEW' || exec.status === 'APPROVED';
      return { ok, detail: `status=${exec.status}${exec.errorMessage ? ` err=${exec.errorMessage.slice(0, 100)}` : ''}` };
    },
  },
  {
    name: 'EPIC artifact created with sections',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'EPIC' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: false, detail: 'no artifact' };
      return { ok: art._count.sections > 0, detail: `${art._count.sections} sections` };
    },
  },
  {
    name: 'EPIC content contains EPIC-NN identifiers',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'EPIC' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const ids = distinctMatches(full, /\bEPIC-\d+(?:-\d+)?\b/g);
      return { ok: ids.size > 0, detail: `${ids.size} epic ids` };
    },
  },
  {
    name: 'RTM rows linked to EPIC',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      if (!mod || !mod.projectId) return { ok: false, detail: 'no module/project' };
      const total = await prisma.baRtmRow.count({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
      const linked = await prisma.baRtmRow.count({
        where: { projectId: mod.projectId, moduleId: mod.moduleId, NOT: { epicId: null } },
      });
      return { ok: linked > 0 && linked === total, detail: `${linked}/${total}` };
    },
  },
];

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const { runChecks, formatChecklist } = require('./lib');
  const phase = process.argv[2];
  const moduleDbId = process.argv[3];
  if (!phase || !moduleDbId) {
    console.error('Usage: ts-node skill-02-s.ts <pre|post> <moduleDbId>');
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
      console.log(formatChecklist(`SKILL-02-S ${phase.toUpperCase()}-CHECKS`, outcome as never));
      return prisma.$disconnect().then(() => process.exit(outcome.allPassed ? 0 : 1));
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(2);
    });
}
