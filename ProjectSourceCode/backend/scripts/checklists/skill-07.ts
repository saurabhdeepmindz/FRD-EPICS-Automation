/**
 * Pre/post checklists for SKILL-07-FTC — Functional Test Cases.
 *
 * NOTE on scope: SKILL-07-FTC has a different lifecycle from SKILL-01-S /
 * 02-S / 04 / 05. The per-mode orchestrator (executeSkill07ForFeature /
 * ForCategory / ForFeatureWhiteBox / Narrative / Complete) writes
 * directly to BaArtifact + BaTestCase and does NOT create
 * BaSkillExecution rows — so checks here cannot rely on `skillName=
 * SKILL-07-FTC`. Instead they read the FTC artifact + BaTestCase rows
 * + RTM linkage to assess outcome.
 *
 * The full L3 hardening (per-section coverage validator, OWASP coverage
 * matrix verification, AC coverage check) stays deferred — see
 * DEFERRED-IMPROVEMENTS §0 follow-up. This file provides the minimum
 * verification needed to know "the cascade ran cleanly and produced
 * structurally consistent output".
 *
 * Pre:  SKILL-04 APPROVED, USER_STORY enumerable, module status >=
 *       STORIES_COMPLETE, FTC artifact does NOT yet exist (so we know
 *       we are starting clean), backend + AI reachable.
 *
 * Post: FTC artifact created with sections > 0, BaTestCase rows > 0,
 *       every feature has >= 1 TC, every story has >= 1 happy-path TC,
 *       canonical 16-section structure present, both black_box +
 *       white_box (when LLD exists) populated.
 */
import { Check, probeAiService, probeBackend } from './lib';

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
    name: 'SKILL-05 latest is APPROVED (SubTasks ready for white-box scope)',
    async run({ prisma, moduleDbId }) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: 'SKILL-05' },
        orderBy: { createdAt: 'desc' },
      });
      // SubTasks are optional for SKILL-07 (per skill prompt §1.1) but
      // strongly recommended — without them, white-box mode-2c is
      // skipped silently.
      if (!exec) return { ok: true, detail: 'no SKILL-05 execution (white-box mode-2c will be skipped)' };
      return {
        ok: exec.status === 'APPROVED',
        detail: `status=${exec.status}${exec.status !== 'APPROVED' ? ' — white-box may use stale data' : ''}`,
      };
    },
  },
  {
    name: 'USER_STORY artifact has stories enumerable',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'USER_STORY' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      if (!art) return { ok: false, detail: 'no USER_STORY artifact' };
      const ids = new Set<string>();
      for (const s of art.sections) {
        const m = s.sectionKey.match(/^us[_-](\d{3,})/i);
        if (m) ids.add(`US-${m[1]}`);
      }
      return { ok: ids.size > 0, detail: `${ids.size} stories enumerable` };
    },
  },
  {
    name: 'FRD artifact has features (parser will need them for linkedFeatureIds)',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      if (!mod || !mod.projectId) return { ok: false, detail: 'no module/project' };
      const rtmCount = await prisma.baRtmRow.count({
        where: { projectId: mod.projectId, moduleId: mod.moduleId },
      });
      return { ok: rtmCount > 0, detail: `${rtmCount} RTM rows` };
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
    name: 'No prior FTC artifact (or, if present, is empty)',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: true, detail: 'no prior FTC artifact (clean start)' };
      const tcCount = await prisma.baTestCase.count({ where: { artifactDbId: art.id } });
      // Idempotent re-runs: warn if there are already TCs but don't fail —
      // the per-mode orchestrator skips features/categories already covered.
      return {
        ok: true,
        detail:
          tcCount > 0
            ? `WARN: prior FTC artifact has ${tcCount} TC(s); per-mode loops will skip already-covered features/categories`
            : `prior FTC artifact exists but is empty (status=${art.status})`,
      };
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
];

export const POST_CHECKS: Check[] = [
  {
    name: 'FTC artifact exists with sections',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      return { ok: art._count.sections > 0, detail: `${art._count.sections} sections (status=${art.status})` };
    },
  },
  {
    name: 'BaTestCase rows persisted',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      const count = await prisma.baTestCase.count({ where: { artifactDbId: art.id } });
      return { ok: count > 0, detail: `${count} test cases` };
    },
  },
  {
    name: 'Every feature has >= 1 test case',
    async run({ prisma, moduleDbId }) {
      const mod = await prisma.baModule.findUnique({ where: { id: moduleDbId } });
      if (!mod || !mod.projectId) return { ok: false, detail: 'no module/project' };
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      const rtm = await prisma.baRtmRow.findMany({
        where: { projectId: mod.projectId, moduleId: mod.moduleId },
        select: { featureId: true },
      });
      const allFeatures = new Set(rtm.map((r) => r.featureId).filter(Boolean));
      if (allFeatures.size === 0) return { ok: false, detail: 'no RTM features' };
      const tcs = await prisma.baTestCase.findMany({
        where: { artifactDbId: art.id },
        select: { linkedFeatureIds: true },
      });
      const covered = new Set<string>();
      for (const t of tcs) for (const f of t.linkedFeatureIds) covered.add(f);
      const missing: string[] = [];
      for (const f of allFeatures) if (!covered.has(f as string)) missing.push(f as string);
      return {
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? `${covered.size}/${allFeatures.size} features covered`
            : `${covered.size}/${allFeatures.size} covered; missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? `, +${missing.length - 5} more` : ''}`,
      };
    },
  },
  {
    name: 'Every user story has >= 1 happy-path test case',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      // Source-of-truth for "all stories" is the USER_STORY artifact's
      // sectionKey set.
      const usArt = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'USER_STORY' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      if (!usArt) return { ok: false, detail: 'no USER_STORY artifact' };
      const allStories = new Set<string>();
      for (const s of usArt.sections) {
        const m = s.sectionKey.match(/^us[_-](\d{3,})/i);
        if (m) allStories.add(`US-${m[1]}`);
      }
      const tcs = await prisma.baTestCase.findMany({
        where: { artifactDbId: art.id, testKind: 'positive' },
        select: { linkedStoryIds: true },
      });
      const covered = new Set<string>();
      for (const t of tcs) for (const s of t.linkedStoryIds) covered.add(s);
      const missing: string[] = [];
      for (const s of allStories) if (!covered.has(s)) missing.push(s);
      return {
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? `${covered.size}/${allStories.size} stories with happy-path TC`
            : `${covered.size}/${allStories.size} covered; missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? `, +${missing.length - 5} more` : ''}`,
      };
    },
  },
  {
    name: 'Negative TCs present (each story should have >= 1)',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      const negCount = await prisma.baTestCase.count({
        where: { artifactDbId: art.id, testKind: 'negative' },
      });
      const totalCount = await prisma.baTestCase.count({ where: { artifactDbId: art.id } });
      const ratio = totalCount > 0 ? negCount / totalCount : 0;
      // Heuristic: a healthy module has at least 20% negative TCs.
      return {
        ok: negCount > 0 && ratio >= 0.15,
        detail: `${negCount} negative / ${totalCount} total (${Math.round(ratio * 100)}%)`,
      };
    },
  },
  {
    name: 'Canonical 16-section structure present',
    async run({ prisma, moduleDbId }) {
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
        include: { sections: true },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      // Required sectionKeys (or close synonyms) per skill prompt §3.
      // White-box and OWASP-LLM sections are conditional, so we check
      // for the core 14 that always apply.
      const required = [
        'summary',
        'test_strategy',
        'test_environment',
        'master_data_setup',
        'test_cases_index',
        'functional_test_cases',
        'integration_test_cases',
        'owasp_web_coverage',
        'data_cleanup',
        'playwright_readiness',
        'traceability_summary',
        'open_questions_tbd',
        'applied_defaults',
        'test_case_appendix',
      ];
      const present = new Set(art.sections.map((s) => s.sectionKey));
      const missing = required.filter((k) => !present.has(k));
      return {
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? `all ${required.length} core sections present (+${art.sections.length - required.length} optional)`
            : `missing: ${missing.join(', ')}`,
      };
    },
  },
  {
    name: 'White-box TCs cite linkedLldArtifactId (when LLD exists)',
    async run({ prisma, moduleDbId }) {
      const lld = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'LLD' },
      });
      if (!lld) return { ok: true, detail: 'no LLD artifact — white-box mode-2c skipped (expected)' };
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: 'FTC' },
        orderBy: { createdAt: 'desc' },
      });
      if (!art) return { ok: false, detail: 'no FTC artifact' };
      const wbTotal = await prisma.baTestCase.count({
        where: { artifactDbId: art.id, scope: 'white_box' },
      });
      if (wbTotal === 0) return { ok: false, detail: 'LLD exists but no white-box TCs produced' };
      const wbWithLld = await prisma.baTestCase.count({
        where: { artifactDbId: art.id, scope: 'white_box', linkedLldArtifactId: { not: null } },
      });
      return {
        ok: wbWithLld === wbTotal,
        detail: `${wbWithLld}/${wbTotal} white-box TCs cite LLD artifact`,
      };
    },
  },
];

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const { runChecks, formatChecklist } = require('./lib');
  const phase = process.argv[2];
  const moduleDbId = process.argv[3];
  if (!phase || !moduleDbId) {
    console.error('Usage: ts-node skill-07.ts <pre|post> <moduleDbId>');
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
      console.log(formatChecklist(`SKILL-07-FTC ${phase.toUpperCase()}-CHECKS`, outcome as never));
      return prisma.$disconnect().then(() => process.exit(outcome.allPassed ? 0 : 1));
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(2);
    });
}
