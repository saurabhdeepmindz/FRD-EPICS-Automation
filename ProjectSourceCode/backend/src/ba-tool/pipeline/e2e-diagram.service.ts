import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type StepRow = {
  stepId: string;
  sequenceNum: number;
  nodeType: string;
  nextStepIds: string[];
  branchLabels: unknown;
  moduleDbId: string | null;
  role: string | null;
  triggerLabel: string | null;
  outcome: string | null;
  layer: string | null;
  thirdPartyIntegrationId: string | null;
  elaborationByStage: unknown;
};

/**
 * R-P5 — builds the 4 Mermaid diagrams for an E2E flow DETERMINISTICALLY from the
 * structured data (so it works without the AI/OpenAI key):
 *   functional   — flowchart of the decision-graph (steps + branches)
 *   integrations — steps → 3rd-party vendors (registry + Integration-layer steps)
 *   classMethod  — classDiagram from the SUBTASK elaboration (R-P3)
 *   dbEntities   — erDiagram from LLD/subtask source files that look like entities
 * Stores them in `BaE2eFlow.mermaidDiagrams`. Idempotent.
 */
@Injectable()
export class E2eDiagramService {
  private readonly logger = new Logger(E2eDiagramService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildDiagrams(projectId: string, flowId: string): Promise<Record<string, string>> {
    const flow = await this.prisma.baE2eFlow.findFirst({
      where: { id: flowId, projectId },
      include: { steps: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!flow) throw new NotFoundException(`E2E flow ${flowId} not found`);

    const moduleDbIds = [...new Set(flow.steps.map((s) => s.moduleDbId).filter((x): x is string => Boolean(x)))];
    const moduleCode = new Map(
      (await this.prisma.baModule.findMany({ where: { id: { in: moduleDbIds } }, select: { id: true, moduleId: true } }))
        .map((m) => [m.id, m.moduleId]),
    );
    const integrations = await this.prisma.baThirdPartyIntegration.findMany({
      where: { projectId },
      select: { id: true, vendorName: true, category: true },
    });

    const steps = flow.steps as unknown as StepRow[];
    const diagrams: Record<string, string> = {
      functional: buildFunctional(steps, moduleCode),
      integrations: buildIntegrations(steps, integrations),
      classMethod: buildClassMethod(steps),
      dbEntities: buildDbEntities(steps),
    };

    await this.prisma.baE2eFlow.update({
      where: { id: flowId },
      data: { mermaidDiagrams: diagrams as Prisma.InputJsonValue },
    });
    this.logger.log(`Built 4 Mermaid diagrams for flow ${flow.flowKey}`);
    return diagrams;
  }
}

// ── deterministic builders ───────────────────────────────────────────────────

function nid(stepId: string): string {
  return 'n_' + stepId.replace(/[^a-zA-Z0-9]/g, '_');
}
function lbl(s: string): string {
  return (s ?? '').replace(/["\n\r]/g, ' ').replace(/[[\]{}|<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48) || ' ';
}

function buildFunctional(steps: StepRow[], moduleCode: Map<string, string>): string {
  if (!steps.length) return 'flowchart TD\n  empty["No steps yet"]';
  const lines = ['flowchart TD'];
  for (const s of steps) {
    const mod = s.moduleDbId ? ` (${moduleCode.get(s.moduleDbId) ?? '?'})` : '';
    const text = lbl(`${s.stepId}: ${s.triggerLabel || s.outcome || ''}${mod}`);
    const id = nid(s.stepId);
    if (s.nodeType === 'DECISION') lines.push(`  ${id}{"${text}"}`);
    else if (s.nodeType === 'START' || s.nodeType === 'END') lines.push(`  ${id}(["${text}"])`);
    else lines.push(`  ${id}["${text}"]`);
  }
  const ids = new Set(steps.map((s) => s.stepId));
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const branchLabels = (s.branchLabels as Record<string, string> | null) ?? {};
    if (s.nextStepIds?.length) {
      for (const nx of s.nextStepIds) {
        if (!ids.has(nx)) continue;
        const bl = branchLabels[nx];
        lines.push(bl ? `  ${nid(s.stepId)} -->|${lbl(bl)}| ${nid(nx)}` : `  ${nid(s.stepId)} --> ${nid(nx)}`);
      }
    } else if (i < steps.length - 1) {
      lines.push(`  ${nid(s.stepId)} --> ${nid(steps[i + 1].stepId)}`); // sequential fallback
    }
  }
  return lines.join('\n');
}

function buildIntegrations(steps: StepRow[], integrations: Array<{ id: string; vendorName: string; category: string }>): string {
  const byId = new Map(integrations.map((i) => [i.id, i]));
  const lines = ['flowchart LR'];
  const used = new Set<string>();
  let hasEdge = false;
  for (const s of steps) {
    const intg = s.thirdPartyIntegrationId ? byId.get(s.thirdPartyIntegrationId) : null;
    if (intg) {
      const ig = 'i_' + intg.id.replace(/[^a-zA-Z0-9]/g, '_');
      if (!used.has(ig)) { lines.push(`  ${ig}["${lbl(intg.vendorName)}<br/>${lbl(intg.category)}"]`); used.add(ig); }
      lines.push(`  ${nid(s.stepId)}["${lbl(s.stepId + ': ' + (s.triggerLabel || ''))}"] --> ${ig}`);
      hasEdge = true;
    } else if (s.layer === 'Integration') {
      lines.push(`  ${nid(s.stepId)}["${lbl(s.stepId + ': ' + (s.triggerLabel || ''))}"] --> ext["External service"]`);
      hasEdge = true;
    }
  }
  if (!hasEdge) {
    if (!integrations.length) return 'flowchart LR\n  none["No integrations on this flow yet"]';
    // No step links yet — just list the registry vendors.
    integrations.forEach((i, k) => lines.push(`  reg${k}["${lbl(i.vendorName)}<br/>${lbl(i.category)}"]`));
  }
  return lines.join('\n');
}

function buildClassMethod(steps: StepRow[]): string {
  const classMethods = new Map<string, Set<string>>();
  for (const s of steps) {
    const sub = (s.elaborationByStage as Record<string, { subtasks?: Array<{ classMethod?: string | null; sourceFile?: string | null }> }> | null)?.SUBTASK;
    for (const st of sub?.subtasks ?? []) {
      const cm = st.classMethod || st.sourceFile;
      if (!cm) continue;
      const [cls, method] = cm.includes('.') ? cm.split('.') : [cm.replace(/\.[a-z]+$/i, ''), ''];
      const key = lbl(cls).replace(/[^a-zA-Z0-9_]/g, '_');
      const set = classMethods.get(key) ?? new Set<string>();
      if (method) set.add(method.replace(/[^a-zA-Z0-9_]/g, '_'));
      classMethods.set(key, set);
    }
  }
  if (!classMethods.size) return 'classDiagram\n  class RunElaborationFirst {\n    +SUBTASK stage needed\n  }';
  const lines = ['classDiagram'];
  let count = 0;
  for (const [cls, methods] of classMethods) {
    if (count++ > 40) break;
    lines.push(`  class ${cls} {`);
    [...methods].slice(0, 12).forEach((m) => lines.push(`    +${m}()`));
    lines.push('  }');
  }
  return lines.join('\n');
}

function buildDbEntities(steps: StepRow[]): string {
  const entities = new Set<string>();
  const ENTITY_RE = /(model|entity|entities|repository|schema|domain)/i;
  for (const s of steps) {
    const elab = s.elaborationByStage as Record<string, { files?: string[]; subtasks?: Array<{ sourceFile?: string | null }> }> | null;
    const files = [
      ...((elab?.LLD?.files) ?? []),
      ...((elab?.SUBTASK?.subtasks ?? []).map((x) => x.sourceFile).filter((x): x is string => Boolean(x))),
    ];
    for (const f of files) {
      if (!ENTITY_RE.test(f)) continue;
      const base = (f.split(/[\\/]/).pop() ?? f).replace(/\.[a-z]+$/i, '').replace(/(repository|model|entity|schema)$/i, '');
      const name = base.replace(/[^a-zA-Z0-9_]/g, '');
      if (name) entities.add(name);
    }
  }
  if (!entities.size) return 'erDiagram\n  RUN_LLD_ELABORATION {\n    note needed\n  }';
  const lines = ['erDiagram'];
  [...entities].slice(0, 30).forEach((e) => lines.push(`  ${e} {\n    string id\n  }`));
  return lines.join('\n');
}
