/**
 * Pre/post checklists for SKILL-04 — User Story generation from EPIC.
 *
 * Pre: SKILL-02-S APPROVED, EPIC artifact has content, module status
 *      >= EPICS_COMPLETE, infra reachable.
 * Post: SKILL-04 not FAILED, USER_STORY artifact created, US-NNN ids
 *       present, every feature has at least one user story, RTM rows
 *       have storyId.
 */
import { Check, distinctMatches, probeAiService, probeBackend, NO_ORPHAN_EXECUTIONS_CHECK } from './lib';

export const PRE_CHECKS: Check[] = [
  {
    name: 'SKILL-02-S latest is APPROVED',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-02-S' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      return { ok: exec.status === 'APPROVED', detail: `status=${exec.status}` };
    },
  },
  {
    name: 'EPIC artifact has content',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'EPIC' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      if (!art) return { ok: false, detail: 'no artifact' };
      const totalLen = art.sections.reduce((sum, s) => sum + s.content.length, 0);
      return { ok: totalLen >= 1000, detail: `${art.sections.length} sections, ${totalLen} chars` };
    },
  },
  {
    name: 'Module status >= EPICS_COMPLETE',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      const order = ['DRAFT', 'SCREENS_UPLOADED', 'ANALYSIS_COMPLETE', 'FRD_COMPLETE', 'EPICS_COMPLETE', 'STORIES_COMPLETE', 'SUBTASKS_COMPLETE', 'APPROVED'];
      const idx = mod ? order.indexOf(mod.moduleStatus) : -1;
      const required = order.indexOf('EPICS_COMPLETE');
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
    name: 'No concurrent live SKILL-04 execution',
    async run({ prisma, moduleDbId }) {
      const live = await prisma.baSkillExecution.count({
        where: { moduleDbId, skillName: 'SKILL-04', status: { in: ['PENDING', 'RUNNING'] } },
      });
      return { ok: live === 0, detail: live > 0 ? `${live} still running` : 'none' };
    },
  },
];

export const POST_CHECKS: Check[] = [
  {
    name: 'SKILL-04 latest is AWAITING_REVIEW or APPROVED (not FAILED)',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-04' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) return { ok: false, detail: 'no execution' };
      const ok = exec.status === 'AWAITING_REVIEW' || exec.status === 'APPROVED';
      return { ok, detail: `status=${exec.status}${exec.errorMessage ? ` err=${exec.errorMessage.slice(0, 100)}` : ''}` };
    },
  },
  {
    name: 'USER_STORY artifact created with sections',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'USER_STORY' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: false, detail: 'no artifact' };
      return { ok: art._count.sections > 0, detail: `${art._count.sections} sections` };
    },
  },
  {
    name: 'USER_STORY content has US-NNN identifiers',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'USER_STORY' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      const full = art ? art.sections.map((s) => s.content).join('\n\n') : '';
      const ids = distinctMatches(full, /\bUS-\d{3,}\b/g);
      return { ok: ids.size > 0, detail: `${ids.size} story ids` };
    },
  },
  {
    name: 'Every feature has >= 1 user story',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      if (!mod || !mod.projectId) return { ok: false, detail: 'no module/project' };
      const rows = await prisma.baRtmRow.findMany({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
      if (rows.length === 0) return { ok: false, detail: 'no RTM rows' };
      const linked = rows.filter((r) => r.storyId).length;
      return { ok: linked >= rows.length - 1, detail: `${linked}/${rows.length} features story-linked` };
    },
  },
  {
    name: 'Every user story carries the canonical 27-section template',
    async run({ prisma, moduleDbId }) {
      // Iterate per-story BaArtifactSection rows (sectionKey starts with
      // `us_` and label like `US-NNN — <Name>`). The orchestrator's
      // splitIntoSections strips the H2 heading line into sectionLabel
      // and stores only the body in content, so the heading would not
      // be in `content.join('\n\n')` — searching for `## US-NNN` there
      // returns 0. Per-row iteration avoids that.
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'USER_STORY' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      if (!art) return { ok: false, detail: 'no USER_STORY artifact' };

      const storyRows = art.sections.filter((s) => /^us[_-]\d{3,}/i.test(s.sectionKey));
      if (storyRows.length === 0) {
        return { ok: false, detail: `no per-story sections found (sectionKey shape ^us[_-]\\d+); ${art.sections.length} sections total` };
      }

      const incomplete: string[] = [];
      for (const r of storyRows) {
        const present = new Set<number>();
        const re = /\*\*(\d+)\.\s/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(r.content)) !== null) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= 27) present.add(n);
        }
        if (present.size < 27) {
          // Extract US-NNN from sectionLabel for friendlier output
          const idMatch = r.sectionLabel.match(/US-\d{3,}/);
          const id = idMatch ? idMatch[0] : r.sectionKey;
          incomplete.push(`${id}(${present.size}/27)`);
        }
      }
      const total = storyRows.length;
      const ok = incomplete.length === 0;
      return {
        ok,
        detail: ok
          ? `${total}/${total} stories with all 27 sections`
          : `${incomplete.length}/${total} stories incomplete: ${incomplete.slice(0, 5).join(', ')}${incomplete.length > 5 ? `, +${incomplete.length - 5} more` : ''}`,
      };
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
    console.error('Usage: ts-node skill-04.ts <pre|post> <moduleDbId>');
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
      console.log(formatChecklist(`SKILL-04 ${phase.toUpperCase()}-CHECKS`, outcome as never));
      return prisma.$disconnect().then(() => process.exit(outcome.allPassed ? 0 : 1));
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(2);
    });
}
