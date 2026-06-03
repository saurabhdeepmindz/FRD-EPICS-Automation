import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * One readiness gate (a required upstream artifact) for a module.
 * `scope` distinguishes project-wide prerequisites (shared by every module)
 * from per-module artifacts.
 */
export interface ReadinessGate {
  key: string;
  label: string;
  scope: 'project' | 'module';
  present: boolean;
  mandatory: boolean; // LLD + Sub-Tasks are hard must-haves; all gates required to be "ready"
  detail?: string; // e.g. "12 sub-tasks", "230 pseudo files", "v2 DRAFT"
}

export interface ModuleReadiness {
  moduleDbId: string;
  moduleId: string; // e.g. MOD-02
  moduleName: string;
  ready: boolean; // true only when EVERY gate is present
  gates: ReadinessGate[];
  missing: string[]; // labels of gates not yet present — drives the "missing: …" hint
}

export interface ProjectReadiness {
  projectId: string;
  projectName: string;
  /** Project-wide gates evaluated once (same for every module). */
  projectGates: ReadinessGate[];
  modules: ModuleReadiness[];
}

/**
 * N-01 — computes per-module code-gen readiness.
 *
 * A module may run `/prd` `/dev` only when **all** upstream artifacts exist:
 *   Project-level:  PRD+FRD · HLD · Wireframes
 *   Module-level:   FRD · EPICs · User Stories · Sub-Tasks (+ rows) · LLD (+ pseudo files)
 *
 * LLD and Sub-Tasks are explicit hard must-haves; the remaining gates are
 * equally required to be selectable. FTC / tests are NOT gates — tests run
 * after code is generated.
 *
 * Pure read-only: no writes, no side effects.
 */
@Injectable()
export class ModuleReadinessService {
  private readonly logger = new Logger(ModuleReadinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Readiness for every module in a project + the shared project gates. */
  async getProjectReadiness(projectId: string): Promise<ProjectReadiness | null> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) return null;

    const { gates: projectGates, hasWireframeSet } = await this.computeProjectGates(projectId);
    const projectReady = projectGates.every((g) => g.present);

    const modules = await this.prisma.baModule.findMany({
      where: { projectId },
      orderBy: { moduleId: 'asc' },
      select: { id: true, moduleId: true, moduleName: true },
    });

    // Bulk-load the module-level signals once, then bucket per module — avoids N+1.
    const moduleIds = modules.map((m) => m.id);
    const [artifacts, subtaskCounts, pseudoRows, screenCounts] = await Promise.all([
      this.prisma.baArtifact.findMany({
        where: { moduleDbId: { in: moduleIds } },
        select: { moduleDbId: true, artifactType: true },
      }),
      this.prisma.baSubTask.groupBy({
        by: ['moduleDbId'],
        where: { moduleDbId: { in: moduleIds } },
        _count: { _all: true },
      }),
      this.prisma.baPseudoFile.findMany({
        where: { artifact: { moduleDbId: { in: moduleIds } } },
        select: { artifact: { select: { moduleDbId: true } } },
      }),
      // Customer-provided wireframe screenshots that went through screen analysis.
      this.prisma.baScreen.groupBy({
        by: ['moduleDbId'],
        where: { moduleDbId: { in: moduleIds } },
        _count: { _all: true },
      }),
    ]);

    const typesByModule = new Map<string, Set<string>>();
    for (const a of artifacts) {
      const set = typesByModule.get(a.moduleDbId) ?? new Set<string>();
      set.add(a.artifactType);
      typesByModule.set(a.moduleDbId, set);
    }
    const subtasksByModule = new Map<string, number>(
      subtaskCounts.map((s) => [s.moduleDbId, s._count._all]),
    );
    const pseudoByModule = new Map<string, number>();
    for (const p of pseudoRows) {
      const mid = p.artifact.moduleDbId;
      pseudoByModule.set(mid, (pseudoByModule.get(mid) ?? 0) + 1);
    }
    const screensByModule = new Map<string, number>(
      screenCounts.map((s) => [s.moduleDbId, s._count._all]),
    );

    const moduleReadiness: ModuleReadiness[] = modules.map((m) => {
      const types = typesByModule.get(m.id) ?? new Set<string>();
      const subtaskCount = subtasksByModule.get(m.id) ?? 0;
      const pseudoCount = pseudoByModule.get(m.id) ?? 0;
      const screenCount = screensByModule.get(m.id) ?? 0;

      // "Wireframes / Screens" is satisfied by EITHER source:
      //   • generated wireframes (Discovery BaWireframeSet, project-level), OR
      //   • customer-provided screenshots that went through screen analysis
      //     (BaScreen uploads + a SCREEN_ANALYSIS artifact, module-level).
      const hasScreenAnalysis = types.has('SCREEN_ANALYSIS') || screenCount > 0;
      const visualPresent = hasWireframeSet || hasScreenAnalysis;
      const visualDetail = hasWireframeSet
        ? 'generated wireframes'
        : hasScreenAnalysis
          ? `${screenCount || 'screenshots'} screen${screenCount === 1 ? '' : 's'} analysed`
          : undefined;

      const moduleGates: ReadinessGate[] = [
        gate('visual', 'Wireframes / Screens', 'module', visualPresent, true, visualDetail),
        gate('frd', 'FRD', 'module', types.has('FRD'), false),
        gate('epics', 'EPICs', 'module', types.has('EPIC'), false),
        gate('user_stories', 'User Stories', 'module', types.has('USER_STORY'), false),
        gate(
          'subtasks',
          'Sub-Tasks',
          'module',
          types.has('SUBTASK') && subtaskCount > 0,
          true,
          subtaskCount ? `${subtaskCount} sub-tasks` : undefined,
        ),
        gate(
          'lld',
          'LLD',
          'module',
          types.has('LLD') && pseudoCount > 0,
          true,
          pseudoCount ? `${pseudoCount} pseudo files` : undefined,
        ),
      ];

      // Project gates are part of every module's gate set so the UI checklist is complete.
      const gates = [...projectGates, ...moduleGates];
      const ready = projectReady && moduleGates.every((g) => g.present);
      const missing = gates.filter((g) => !g.present).map((g) => g.label);

      return {
        moduleDbId: m.id,
        moduleId: m.moduleId,
        moduleName: m.moduleName,
        ready,
        gates,
        missing,
      };
    });

    return {
      projectId: project.id,
      projectName: project.name,
      projectGates,
      modules: moduleReadiness,
    };
  }

  /** Readiness for a single module — reused by run-scoping (N-03). */
  async getModuleReadiness(
    projectId: string,
    moduleDbId: string,
  ): Promise<ModuleReadiness | null> {
    const all = await this.getProjectReadiness(projectId);
    if (!all) return null;
    return all.modules.find((m) => m.moduleDbId === moduleDbId) ?? null;
  }

  // ── project-level gates (shared across all modules) ────────────────────────

  /**
   * PRD+FRD and HLD are project-wide gates. The wireframe set is returned as a
   * flag (not a gate) because the visual-design requirement is evaluated per
   * module — it can be satisfied by a project wireframe set OR by a module's
   * analysed screenshots (see the per-module `visual` gate).
   */
  private async computeProjectGates(
    projectId: string,
  ): Promise<{ gates: ReadinessGate[]; hasWireframeSet: boolean }> {
    const [prd, hld, wireframeSet] = await Promise.all([
      this.prisma.baProjectPrd.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true, status: true },
      }),
      this.prisma.baHld.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true, status: true },
      }),
      this.prisma.baWireframeSet.findFirst({
        where: { projectId },
        select: { id: true },
      }),
    ]);

    return {
      hasWireframeSet: Boolean(wireframeSet),
      gates: [
        gate(
          'prd_frd',
          'PRD + FRD',
          'project',
          Boolean(prd),
          true,
          prd ? `v${prd.version} ${prd.status}` : undefined,
        ),
        gate(
          'hld',
          'HLD',
          'project',
          Boolean(hld),
          true,
          hld ? `v${hld.version} ${hld.status}` : undefined,
        ),
      ],
    };
  }
}

function gate(
  key: string,
  label: string,
  scope: 'project' | 'module',
  present: boolean,
  mandatory: boolean,
  detail?: string,
): ReadinessGate {
  return { key, label, scope, present, mandatory, detail };
}
