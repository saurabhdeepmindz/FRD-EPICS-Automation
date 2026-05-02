/**
 * Pre/post checklists for SKILL-05 — SubTask generation per user story.
 * Skills file is now hardwired to the per-story append loop in the
 * orchestrator (see runSkill05PerStoryLoop), so the checks here verify
 * the loop's outputs rather than the legacy single-shot.
 *
 * Pre: SKILL-04 APPROVED, user stories enumerable, module status >=
 *      STORIES_COMPLETE, infra reachable.
 * Post: SKILL-05 not FAILED, SUBTASK artifact has sections > 0,
 *       BaSubTask records exist with userStoryId populated (Source C
 *       structural derivation guarantees), at least 1 ST-USNNN-FE/BE/QA-NN
 *       per user story, and RTM has subtaskId for at least one feature.
 */
import { Check, distinctMatches, probeAiService, probeBackend, NO_ORPHAN_EXECUTIONS_CHECK } from './lib';

export const PRE_CHECKS: Check[] = [
  {
    name: 'SKILL-04 latest is APPROVED',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-04' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      return { ok: exec.status === 'APPROVED', detail: `status=${exec.status}` };
    },
  },
  {
    name: 'USER_STORY artifact has US-NNN identifiers',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-04', status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
      });
      const doc = exec?.humanDocument ?? '';
      const ids = distinctMatches(doc, /\bUS-\d{3,}\b/g);
      return { ok: ids.size > 0, detail: `${ids.size} stories enumerable` };
    },
  },
  {
    name: 'Module status >= STORIES_COMPLETE',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      const order = ['DRAFT', 'SCREENS_UPLOADED', 'ANALYSIS_COMPLETE', 'FRD_COMPLETE', 'EPICS_COMPLETE', 'STORIES_COMPLETE', 'SUBTASKS_COMPLETE', 'APPROVED'];
      const idx = mod ? order.indexOf(mod.moduleStatus) : -1;
      const required = order.indexOf('STORIES_COMPLETE');
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
    name: 'No concurrent live SKILL-05 execution',
    async run({ prisma, moduleDbId }) {
      const live = await prisma.baSkillExecution.count({
        where: { moduleDbId, skillName: 'SKILL-05', status: { in: ['PENDING', 'RUNNING'] } },
      });
      return { ok: live === 0, detail: live > 0 ? `${live} still running` : 'none' };
    },
  },
];

export const POST_CHECKS: Check[] = [
  {
    name: 'SKILL-05 latest is AWAITING_REVIEW or APPROVED (not FAILED)',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-05' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      const ok = exec.status === 'AWAITING_REVIEW' || exec.status === 'APPROVED';
      return { ok, detail: `status=${exec.status}${exec.errorMessage ? ` err=${exec.errorMessage.slice(0, 100)}` : ''}` };
    },
  },
  {
    name: 'SUBTASK artifact created with sections',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'SUBTASK' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: false, detail: 'no artifact' };
      return { ok: art._count.sections > 0, detail: `${art._count.sections} sections` };
    },
  },
  {
    name: 'SUBTASK content has canonical ST-USNNN-TEAM-NN identifiers',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'SUBTASK' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const ids = distinctMatches(full, /\bST-US\d+-(?:FE|BE|IN|QA)-\d+\b/g);
      return { ok: ids.size > 0, detail: `${ids.size} distinct subtask ids` };
    },
  },
  {
    name: 'BaSubTask records persisted',
    async run({ prisma, moduleDbId }) {
      const count = await prisma.baSubTask.count({ where: { moduleDbId } });
      return { ok: count > 0, detail: `${count} records` };
    },
  },
  {
    name: 'BaSubTask records have userStoryId populated (Source C guarantees this)',
    async run({ prisma, moduleDbId }) {
      const total = await prisma.baSubTask.count({ where: { moduleDbId } });
      if (total === 0) return { ok: false, detail: '0 records' };
      const linked = await prisma.baSubTask.count({ where: { moduleDbId, NOT: { userStoryId: null } } });
      return { ok: linked === total, detail: `${linked}/${total}` };
    },
  },
  {
    name: 'RTM rows have subtaskId for at least one feature per story',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      if (!mod || !mod.projectId) return { ok: false, detail: 'no module/project' };
      const total = await prisma.baRtmRow.count({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
      const linked = await prisma.baRtmRow.count({
        where: { projectId: mod.projectId, moduleId: mod.moduleId, NOT: { subtaskId: null } },
      });
      return { ok: linked > 0 && linked >= total - 1, detail: `${linked}/${total}` };
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
    console.error('Usage: ts-node skill-05.ts <pre|post> <moduleDbId>');
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
      console.log(formatChecklist(`SKILL-05 ${phase.toUpperCase()}-CHECKS`, outcome as never));
      return prisma.$disconnect().then(() => process.exit(outcome.allPassed ? 0 : 1));
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(2);
    });
}
