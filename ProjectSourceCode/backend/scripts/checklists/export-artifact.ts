/**
 * Pre/post checklists for PDF / DOCX export of BA-Tool artifacts.
 *
 * Different lifecycle from skill-XX.ts:
 *   - Skills run via POST /execute/:skill, write to BaArtifact + BaSkillExecution.
 *   - Exports are pure read-side: GET /artifacts/:id/export/{pdf,docx} — no DB
 *     writes. This script's job is to verify the source data is healthy
 *     enough to render BEFORE triggering, then validate the produced file
 *     AFTER triggering.
 *
 * Pre  (DB-only): artifact + sections + project metadata + screen refs +
 *                 puppeteer availability for PDF.
 * Post (file-byte): HTTP 200, magic-bytes match format, size in sane range,
 *                   not the HTML-buffer fallback (puppeteer dropped), file
 *                   contains expected identifiers (artifactId, moduleId).
 *
 * Usage:
 *   # Pre-checks only (DB-only, no HTTP):
 *   npx ts-node scripts/checklists/export-artifact.ts pre <artifactDbId>
 *
 *   # Pre + trigger + post for an FRD/EPIC/USER_STORY artifact:
 *   npx ts-node scripts/checklists/export-artifact.ts run <artifactDbId> pdf
 *   npx ts-node scripts/checklists/export-artifact.ts run <artifactDbId> docx
 *
 *   # Same but for a SubTask (different endpoint shape):
 *   npx ts-node scripts/checklists/export-artifact.ts run-subtask <subtaskDbId> pdf
 *
 * Exit codes: 0 = all green; 1 = any check failed; 2 = bad invocation.
 */
import { PrismaClient } from '@prisma/client';
import { Check, CheckContext, runChecks, formatChecklist, probeBackend } from './lib';

// ─── Local extension of CheckContext ─────────────────────────────────────
// The shared lib's CheckContext is keyed off moduleDbId (the cascade's unit
// of work). Exports are keyed off artifactDbId. Carry both so module-level
// checks (project metadata, screens) and artifact-level checks (sections)
// can run in the same script.

export interface ExportCheckContext extends CheckContext {
  artifactDbId: string;
  // Subtask exports go through a different controller path; carry the kind
  // discriminator so post-checks know which endpoint to hit.
  subtaskDbId?: string;
  format?: 'pdf' | 'docx';
  // Populated by the runner after the export HTTP call. Post-checks read
  // these to validate file integrity.
  exportResult?: {
    httpStatus: number;
    contentType: string | null;
    bytes: Buffer;
    filename: string;
    durationMs: number;
  };
}

// ─── PRE-CHECKS (DB-only; safe to run repeatedly) ────────────────────────

export const PRE_CHECKS: Check[] = [
  {
    name: 'Artifact or SubTask exists',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      if (c.subtaskDbId) {
        const st = await c.prisma.baSubTask.findUnique({ where: { id: c.subtaskDbId } });
        return st
          ? { ok: true, detail: `SubTask ${st.subtaskId} (status=${st.status})` }
          : { ok: false, detail: `SubTask ${c.subtaskDbId} not found` };
      }
      const art = await c.prisma.baArtifact.findUnique({ where: { id: c.artifactDbId } });
      return art
        ? { ok: true, detail: `${art.artifactType} ${art.artifactId} (status=${art.status})` }
        : { ok: false, detail: `Artifact ${c.artifactDbId} not found` };
    },
  },
  {
    name: 'Has at least one non-empty section',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const sections = c.subtaskDbId
        ? await c.prisma.baSubTaskSection.findMany({
            where: { subtaskDbId: c.subtaskDbId },
            select: { aiContent: true, editedContent: true, isHumanModified: true },
          })
        : await c.prisma.baArtifactSection.findMany({
            where: { artifactId: c.artifactDbId },
            select: { content: true, editedContent: true, isHumanModified: true },
          });
      if (sections.length === 0) return { ok: false, detail: 'no sections' };
      const nonEmpty = sections.filter((s) => {
        const body = s.isHumanModified && s.editedContent
          ? s.editedContent
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : ((s as any).content ?? (s as any).aiContent ?? '');
        return typeof body === 'string' && body.trim().length > 0;
      });
      return {
        ok: nonEmpty.length > 0,
        detail: `${nonEmpty.length}/${sections.length} sections have content`,
      };
    },
  },
  {
    name: 'Project cover-page metadata populated',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      let projectId: string | null = null;
      if (c.subtaskDbId) {
        const st = await c.prisma.baSubTask.findUnique({
          where: { id: c.subtaskDbId },
          include: { module: { select: { projectId: true } } },
        });
        projectId = st?.module?.projectId ?? null;
      } else {
        const art = await c.prisma.baArtifact.findUnique({
          where: { id: c.artifactDbId },
          include: { module: { select: { projectId: true } } },
        });
        projectId = art?.module?.projectId ?? null;
      }
      if (!projectId) return { ok: false, detail: 'no project linked' };
      const project = await c.prisma.baProject.findUnique({
        where: { id: projectId },
        select: { name: true, projectCode: true, productName: true, clientName: true, submittedBy: true },
      });
      if (!project) return { ok: false, detail: 'project row missing' };
      const missing: string[] = [];
      if (!project.name?.trim()) missing.push('name');
      if (!project.projectCode?.trim()) missing.push('projectCode');
      // productName, clientName, submittedBy are render-soft (fallbacks exist),
      // so warn but don't fail.
      const soft: string[] = [];
      if (!project.productName?.trim()) soft.push('productName');
      if (!project.clientName?.trim()) soft.push('clientName');
      if (!project.submittedBy?.trim()) soft.push('submittedBy');
      const detail =
        (missing.length === 0 ? 'cover-page hard fields OK' : `missing hard fields: ${missing.join(', ')}`)
        + (soft.length ? ` (soft fallbacks for: ${soft.join(', ')})` : '');
      return { ok: missing.length === 0, detail };
    },
  },
  {
    name: 'Module screens resolvable for SCR-NN references',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      // Walk all section bodies, extract bare SCR-NN tokens, verify each
      // resolves to a row in BaScreen for the same module.
      let moduleDbId: string | null = null;
      let bodies: string[] = [];
      if (c.subtaskDbId) {
        const st = await c.prisma.baSubTask.findUnique({
          where: { id: c.subtaskDbId },
          include: { sections: { select: { aiContent: true, editedContent: true, isHumanModified: true } } },
        });
        if (!st) return { ok: false, detail: 'subtask not found' };
        moduleDbId = st.moduleDbId;
        bodies = st.sections.map((s) => s.isHumanModified && s.editedContent ? s.editedContent : s.aiContent);
      } else {
        const art = await c.prisma.baArtifact.findUnique({
          where: { id: c.artifactDbId },
          include: { sections: { select: { content: true, editedContent: true, isHumanModified: true } } },
        });
        if (!art) return { ok: false, detail: 'artifact not found' };
        moduleDbId = art.moduleDbId;
        bodies = art.sections.map((s) => s.isHumanModified && s.editedContent ? s.editedContent : s.content);
      }
      if (!moduleDbId) return { ok: false, detail: 'no module linked' };
      const refs = new Set<string>();
      for (const b of bodies) {
        if (!b) continue;
        for (const m of b.matchAll(/\bSCR-\d+\b/g)) refs.add(m[0]);
      }
      if (refs.size === 0) return { ok: true, detail: 'no SCR-NN refs in body (nothing to resolve)' };
      const screens = await c.prisma.baScreen.findMany({
        where: { moduleDbId },
        select: { screenId: true },
      });
      const known = new Set(screens.map((s) => s.screenId));
      const dangling = [...refs].filter((r) => !known.has(r));
      return {
        ok: dangling.length === 0,
        detail:
          dangling.length === 0
            ? `${refs.size} unique refs, all resolve`
            : `${dangling.length}/${refs.size} dangling: ${dangling.slice(0, 5).join(', ')}${dangling.length > 5 ? `, +${dangling.length - 5} more` : ''}`,
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
    name: 'Puppeteer available (PDF only — silent fallback otherwise)',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      // Only check when PDF is requested. DOCX path is independent of
      // puppeteer (used only for embedded mermaid PNG rendering, which
      // gracefully degrades to source-text on failure).
      if (c.format && c.format !== 'pdf') return { ok: true, detail: 'skipped (format=docx)' };
      try {
        // require.resolve is cheap and avoids spawning Chromium just to check.
        require.resolve('puppeteer');
        return { ok: true, detail: 'puppeteer module resolves' };
      } catch {
        return {
          ok: false,
          detail: 'puppeteer not installed — PDF export will silently return raw HTML buffer (per pdf.service.ts:29-33)',
        };
      }
    },
  },
];

// ─── POST-CHECKS (file-byte validation; require ctx.exportResult) ────────

export const POST_CHECKS: Check[] = [
  {
    name: 'HTTP 200 OK',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r) return { ok: false, detail: 'no exportResult — runner did not invoke endpoint' };
      return { ok: r.httpStatus === 200, detail: `status=${r.httpStatus}` };
    },
  },
  {
    name: 'Content-Type header matches format',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r) return { ok: false, detail: 'no exportResult' };
      const expected =
        c.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const actual = r.contentType?.toLowerCase() ?? '';
      return {
        ok: actual.includes(expected),
        detail: `expected ${expected}, got ${r.contentType ?? '(none)'}`,
      };
    },
  },
  {
    name: 'Magic bytes match format',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r || r.bytes.length < 4) return { ok: false, detail: 'no bytes' };
      if (c.format === 'pdf') {
        const head = r.bytes.subarray(0, 4).toString('ascii');
        return {
          ok: head === '%PDF',
          detail: head === '%PDF' ? 'starts with %PDF' : `starts with "${head}" (not a PDF — likely HTML fallback)`,
        };
      }
      // DOCX = ZIP file: PK\x03\x04
      const head4 = r.bytes.subarray(0, 4);
      const isZip = head4[0] === 0x50 && head4[1] === 0x4b && head4[2] === 0x03 && head4[3] === 0x04;
      return {
        ok: isZip,
        detail: isZip ? 'starts with PK (zip)' : `bytes=${head4.toString('hex')} (not a docx)`,
      };
    },
  },
  {
    name: 'File size in sane range',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r) return { ok: false, detail: 'no exportResult' };
      const kb = r.bytes.length / 1024;
      // 20 KB lower bound (anything smaller is suspect — empty cover or html-fallback)
      // 50 MB upper bound (hard ceiling — base64 screen embedding can balloon, but
      // anything past this likely indicates duplicated images).
      const min = 20;
      const max = 50 * 1024;
      const ok = kb >= min && kb <= max;
      return {
        ok,
        detail: `${kb.toFixed(1)} KB (expected ${min}–${max} KB)`,
      };
    },
  },
  {
    name: 'Not the HTML fallback (puppeteer-unavailable case)',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r) return { ok: false, detail: 'no exportResult' };
      if (c.format !== 'pdf') return { ok: true, detail: 'skipped (docx)' };
      const head = r.bytes.subarray(0, 256).toString('utf-8').toLowerCase();
      const isHtml = head.includes('<!doctype html') || head.includes('<html');
      return {
        ok: !isHtml,
        detail: isHtml ? 'response body is HTML, not PDF — puppeteer fallback path triggered' : 'PDF binary confirmed',
      };
    },
  },
  {
    name: 'File contains the artifact identifier (sanity check)',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r) return { ok: false, detail: 'no exportResult' };
      // For PDF, identifiers are visible in the raw bytes (PDF strings live
      // in plain text outside compressed object streams). For DOCX, the body
      // is zipped — we'd need to unzip to grep for content. So we just
      // assert the filename contains the expected stem instead.
      let needle: string;
      if (c.subtaskDbId) {
        const st = await c.prisma.baSubTask.findUnique({ where: { id: c.subtaskDbId } });
        needle = st?.subtaskId ?? '';
      } else {
        const art = await c.prisma.baArtifact.findUnique({ where: { id: c.artifactDbId } });
        needle = art?.artifactId ?? '';
      }
      if (!needle) return { ok: false, detail: 'cannot resolve identifier' };
      if (c.format === 'pdf') {
        const text = r.bytes.toString('latin1');
        const found = text.includes(needle);
        return {
          ok: found,
          detail: found ? `PDF body mentions ${needle}` : `PDF body missing ${needle} (cover page may not have rendered)`,
        };
      }
      // DOCX: filename check only (cheap; full parse would need adm-zip).
      const inFilename = r.filename.includes(needle.replace(/\s+/g, '_'));
      return {
        ok: inFilename,
        detail: inFilename ? `filename contains ${needle}` : `filename "${r.filename}" missing ${needle}`,
      };
    },
  },
  {
    name: 'Render duration within budget (< 60s)',
    async run(ctx) {
      const c = ctx as ExportCheckContext;
      const r = c.exportResult;
      if (!r) return { ok: false, detail: 'no exportResult' };
      const sec = r.durationMs / 1000;
      // 60s budget covers worst-case puppeteer cold start + mermaid rendering
      // for an FRD with many diagrams. Beyond that we likely have a stuck
      // browser process.
      return {
        ok: sec < 60,
        detail: `${sec.toFixed(1)}s (budget 60s)`,
      };
    },
  },
];

// ─── Standalone runner ───────────────────────────────────────────────────

async function triggerExport(
  apiBase: string,
  ctx: ExportCheckContext,
): Promise<NonNullable<ExportCheckContext['exportResult']>> {
  const url = ctx.subtaskDbId
    ? `${apiBase}/api/ba/subtasks/${ctx.subtaskDbId}/export/${ctx.format}`
    : `${apiBase}/api/ba/artifacts/${ctx.artifactDbId}/export/${ctx.format}`;
  const t0 = Date.now();
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const durationMs = Date.now() - t0;
  // Extract filename from Content-Disposition: attachment; filename="..."
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename="?([^";]+)"?/.exec(cd);
  return {
    httpStatus: res.status,
    contentType: res.headers.get('content-type'),
    bytes: buf,
    filename: m?.[1] ?? '(no filename)',
    durationMs,
  };
}

if (require.main === module) {
  const phase = process.argv[2];
  const id = process.argv[3];
  const formatArg = process.argv[4] as 'pdf' | 'docx' | undefined;

  const usage =
    'Usage:\n' +
    '  ts-node export-artifact.ts pre <artifactDbId>\n' +
    '  ts-node export-artifact.ts run <artifactDbId> <pdf|docx>\n' +
    '  ts-node export-artifact.ts run-subtask <subtaskDbId> <pdf|docx>';

  if (!phase || !id) {
    console.error(usage);
    process.exit(2);
  }

  const isSubtask = phase === 'run-subtask';
  if ((phase === 'run' || isSubtask) && !formatArg) {
    console.error(usage);
    process.exit(2);
  }
  if (formatArg && formatArg !== 'pdf' && formatArg !== 'docx') {
    console.error(`format must be "pdf" or "docx", got "${formatArg}"`);
    process.exit(2);
  }

  const apiBase = process.env.API_BASE ?? 'http://localhost:4000';
  const prisma = new PrismaClient();

  const ctx: ExportCheckContext = {
    prisma,
    moduleDbId: '', // populated below from the artifact/subtask row
    apiBase,
    artifactDbId: isSubtask ? '' : id,
    subtaskDbId: isSubtask ? id : undefined,
    format: formatArg,
  };

  (async () => {
    // Resolve moduleDbId so module-scoped checks in the shared lib work.
    if (isSubtask) {
      const st = await prisma.baSubTask.findUnique({ where: { id }, select: { moduleDbId: true } });
      ctx.moduleDbId = st?.moduleDbId ?? '';
    } else {
      const art = await prisma.baArtifact.findUnique({ where: { id }, select: { moduleDbId: true } });
      ctx.moduleDbId = art?.moduleDbId ?? '';
    }

    const pre = await runChecks(PRE_CHECKS, ctx);
    console.log(formatChecklist('EXPORT PRE-CHECKS', pre));
    if (!pre.allPassed) {
      await prisma.$disconnect();
      process.exit(1);
    }

    if (phase === 'pre') {
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`\nTriggering ${formatArg!.toUpperCase()} export...`);
    try {
      ctx.exportResult = await triggerExport(apiBase, ctx);
      console.log(
        `  → ${ctx.exportResult.httpStatus} ${ctx.exportResult.contentType ?? ''} (${(ctx.exportResult.bytes.length / 1024).toFixed(1)} KB in ${ctx.exportResult.durationMs}ms)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error(`  → trigger failed: ${msg}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const post = await runChecks(POST_CHECKS, ctx);
    console.log(formatChecklist('EXPORT POST-CHECKS', post));

    await prisma.$disconnect();
    process.exit(post.allPassed ? 0 : 1);
  })().catch((err) => {
    console.error(err);
    prisma.$disconnect().finally(() => process.exit(2));
  });
}
