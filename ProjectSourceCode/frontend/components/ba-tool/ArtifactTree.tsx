'use client';

import { useState } from 'react';
import { useMemo } from 'react';
import { SKILL_LABELS, type BaArtifact, type BaArtifactSection, type BaSkillExecution } from '@/lib/ba-api';
import { parseFrdContent, type ParsedFeature } from '@/lib/frd-parser';
import { ChevronRight, ChevronDown, FileText, Layers, BookOpen, ListChecks, Cog, Sparkles, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Tree node types ─────────────────────────────────────────────────────────

export interface TreeNodeId {
  type: 'skill' | 'artifact' | 'section';
  skillName?: string;
  artifactId?: string;
  sectionId?: string;
}

interface SkillNode {
  skillName: string;
  label: string;
  status: string;
  artifacts: ArtifactNode[];
}

interface ArtifactNode {
  artifact: BaArtifact;
  label: string;
  icon: 'frd' | 'epic' | 'story' | 'subtask' | 'screen' | 'other';
  teamBadge?: string; // FE, BE, QA, IN
  statusBadge?: string;
  children: SectionNode[];
  features: FeatureNode[]; // parsed FRD features (only for FRD artifacts)
}

interface SectionNode {
  section: BaArtifactSection;
  label: string;
  isAi: boolean;
  isEdited: boolean;
}

interface FeatureNode {
  featureId: string;
  featureName: string;
  priority: string;
  status: string;
}

interface ArtifactTreeProps {
  executions: BaSkillExecution[];
  artifacts: BaArtifact[];
  activeNode: TreeNodeId | null;
  onNodeSelect: (node: TreeNodeId) => void;
}

// ─── Build tree from executions + artifacts ──────────────────────────────────

function buildTree(executions: BaSkillExecution[], artifacts: BaArtifact[]): SkillNode[] {
  const skillOrder = ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04', 'SKILL-05'];
  const completedSkills = executions.filter(
    (e) => e.status === 'AWAITING_REVIEW' || e.status === 'APPROVED' || e.status === 'COMPLETED',
  );

  const tree: SkillNode[] = [];

  for (const skillName of skillOrder) {
    const exec = completedSkills.find((e) => e.skillName === skillName);
    if (!exec) continue;

    // Find artifacts for this skill
    const skillArtifacts = getArtifactsForSkill(skillName, artifacts);

    const artifactNodes: ArtifactNode[] = skillArtifacts.map((artifact) => {
      const teamBadge = extractTeamBadge(artifact.artifactId);
      const statusBadge = artifact.status === 'CONFIRMED_PARTIAL' ? 'TBD' : undefined;

      // Parse FRD features for FRD artifacts
      let features: FeatureNode[] = [];
      if (artifact.artifactType === 'FRD') {
        const parsed = parseFrdContent(artifact.sections);
        features = parsed.features.map((f) => ({
          featureId: f.featureId,
          featureName: f.featureName,
          priority: f.priority,
          status: f.status,
        }));
      }

      return {
        artifact,
        label: formatArtifactLabel(artifact),
        icon: getArtifactIcon(artifact.artifactType),
        teamBadge,
        statusBadge,
        features,
        children: artifact.artifactType === 'FRD'
          ? [] // FRD shows features instead of raw sections
          : artifact.sections.map((section) => ({
              section,
              label: section.sectionLabel,
              isAi: section.aiGenerated && !section.isHumanModified,
              isEdited: section.isHumanModified,
            })),
      };
    });

    tree.push({
      skillName,
      label: SKILL_LABELS[skillName] ?? skillName,
      status: exec.status,
      artifacts: artifactNodes,
    });
  }

  return tree;
}

function getArtifactsForSkill(skillName: string, artifacts: BaArtifact[]): BaArtifact[] {
  const typeMap: Record<string, string> = {
    'SKILL-00': 'SCREEN_ANALYSIS',
    'SKILL-01-S': 'FRD',
    'SKILL-02-S': 'EPIC',
    'SKILL-04': 'USER_STORY',
    'SKILL-05': 'SUBTASK',
  };
  const type = typeMap[skillName];
  if (!type) return [];
  return artifacts.filter((a) => a.artifactType === type);
}

function formatArtifactLabel(artifact: BaArtifact): string {
  return artifact.artifactId;
}

function getArtifactIcon(type: string): ArtifactNode['icon'] {
  switch (type) {
    case 'FRD': return 'frd';
    case 'EPIC': return 'epic';
    case 'USER_STORY': return 'story';
    case 'SUBTASK': return 'subtask';
    case 'SCREEN_ANALYSIS': return 'screen';
    default: return 'other';
  }
}

function extractTeamBadge(artifactId: string): string | undefined {
  if (artifactId.includes('-FE-')) return 'FE';
  if (artifactId.includes('-BE-')) return 'BE';
  if (artifactId.includes('-IN-')) return 'IN';
  if (artifactId.includes('-QA-')) return 'QA';
  return undefined;
}

const ICON_MAP = {
  frd: FileText,
  epic: Layers,
  story: BookOpen,
  subtask: Cog,
  screen: FileText,
  other: ListChecks,
};

const SKILL_ICONS: Record<string, typeof FileText> = {
  'SKILL-00': FileText,
  'SKILL-01-S': FileText,
  'SKILL-02-S': Layers,
  'SKILL-04': BookOpen,
  'SKILL-05': Cog,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ArtifactTree({ executions, artifacts, activeNode, onNodeSelect }: ArtifactTreeProps) {
  const tree = buildTree(executions, artifacts);
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const node of tree) map[node.skillName] = true;
    return map;
  });
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No artifacts generated yet.</p>
        <p className="text-[10px] text-muted-foreground mt-1">Run a skill to see results here.</p>
      </div>
    );
  }

  return (
    <nav className="py-1 text-[13px]" data-testid="artifact-tree">
      {tree.map((skillNode) => {
        const isSkillExpanded = expandedSkills[skillNode.skillName] ?? true;
        const SkillIcon = SKILL_ICONS[skillNode.skillName] ?? FileText;
        const isSkillActive = activeNode?.type === 'skill' && activeNode.skillName === skillNode.skillName;

        return (
          <div key={skillNode.skillName}>
            {/* ── Level 0: Skill ── */}
            <div className="flex items-center">
              <button
                onClick={() => setExpandedSkills((p) => ({ ...p, [skillNode.skillName]: !p[skillNode.skillName] }))}
                className="pl-2 pr-0 py-1.5 text-muted-foreground hover:text-foreground"
              >
                {isSkillExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => onNodeSelect({ type: 'skill', skillName: skillNode.skillName })}
                className={cn(
                  'flex-1 flex items-center gap-2 pl-1 pr-3 py-1.5 text-left transition-colors',
                  isSkillActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted',
                )}
              >
                <SkillIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium">{skillNode.label}</span>
                <span className={cn(
                  'ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                  skillNode.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                )}>
                  {skillNode.status === 'APPROVED' ? 'Done' : 'Review'}
                </span>
              </button>
            </div>

            {/* ── Level 1: Artifacts ── */}
            {isSkillExpanded && (
              <div className="ml-5 border-l border-border/50">
                {skillNode.artifacts.map((artifactNode) => {
                  const isArtifactExpanded = expandedArtifacts[artifactNode.artifact.id] ??
                    (activeNode?.artifactId === artifactNode.artifact.id);
                  const isArtifactActive = activeNode?.type === 'artifact' && activeNode.artifactId === artifactNode.artifact.id;
                  const ArtifactIcon = ICON_MAP[artifactNode.icon];

                  return (
                    <div key={artifactNode.artifact.id}>
                      <div className="flex items-center">
                        {artifactNode.children.length > 0 ? (
                          <button
                            onClick={() => setExpandedArtifacts((p) => ({ ...p, [artifactNode.artifact.id]: !p[artifactNode.artifact.id] }))}
                            className="pl-2 pr-0 py-1 text-muted-foreground hover:text-foreground"
                          >
                            {isArtifactExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                        ) : (
                          <span className="w-[18px] pl-2" />
                        )}
                        <button
                          onClick={() => {
                            onNodeSelect({ type: 'artifact', skillName: artifactNode.artifact.artifactType, artifactId: artifactNode.artifact.id });
                            if (!isArtifactExpanded) {
                              setExpandedArtifacts((p) => ({ ...p, [artifactNode.artifact.id]: true }));
                            }
                          }}
                          className={cn(
                            'flex-1 flex items-center gap-1.5 pl-1 pr-2 py-1 text-left text-xs transition-colors',
                            isArtifactActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                          )}
                        >
                          <ArtifactIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{artifactNode.label}</span>
                          {artifactNode.teamBadge && (
                            <span className={cn(
                              'text-[8px] px-1 py-0.5 rounded font-bold shrink-0',
                              artifactNode.teamBadge === 'FE' ? 'bg-blue-100 text-blue-700' :
                              artifactNode.teamBadge === 'BE' ? 'bg-purple-100 text-purple-700' :
                              artifactNode.teamBadge === 'QA' ? 'bg-green-100 text-green-700' :
                              'bg-orange-100 text-orange-700',
                            )}>
                              {artifactNode.teamBadge}
                            </span>
                          )}
                          {artifactNode.statusBadge && (
                            <span title="TBD-Future"><AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" /></span>
                          )}
                          <span className="ml-auto text-[9px] text-muted-foreground/50 shrink-0">
                            {artifactNode.children.length}
                          </span>
                        </button>
                      </div>

                      {/* ── Level 2: FRD Features (for FRD artifacts) ── */}
                      {isArtifactExpanded && artifactNode.features.length > 0 && (
                        <div className="ml-5 border-l border-border/30">
                          {artifactNode.features.map((feat) => {
                            const isFeatureActive = activeNode?.type === 'section'
                              && activeNode.artifactId === artifactNode.artifact.id
                              && activeNode.sectionId === feat.featureId;

                            const priorityCls = feat.priority.toLowerCase().includes('must')
                              ? 'bg-red-100 text-red-700'
                              : feat.priority.toLowerCase().includes('should')
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600';

                            return (
                              <button
                                key={feat.featureId}
                                onClick={() => onNodeSelect({
                                  type: 'section',
                                  artifactId: artifactNode.artifact.id,
                                  sectionId: feat.featureId,
                                })}
                                className={cn(
                                  'w-full flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-left text-[11px] transition-colors',
                                  isFeatureActive
                                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                )}
                              >
                                <span className="font-mono text-primary shrink-0">{feat.featureId}</span>
                                <span className="truncate">{feat.featureName}</span>
                                {feat.priority && (
                                  <span className={cn('text-[8px] px-1 py-0.5 rounded font-medium shrink-0 ml-auto', priorityCls)}>
                                    {feat.priority.split(' ')[0]}
                                  </span>
                                )}
                                {feat.status.includes('PARTIAL') && (
                                  <span title="TBD-Future"><AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" /></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Level 2: Sections (for non-FRD artifacts) ── */}
                      {isArtifactExpanded && artifactNode.children.length > 0 && (
                        <div className="ml-5 border-l border-border/30">
                          {artifactNode.children.map((sectionNode) => {
                            const isSectionActive = activeNode?.type === 'section' && activeNode.sectionId === sectionNode.section.id;

                            return (
                              <button
                                key={sectionNode.section.id}
                                onClick={() => onNodeSelect({
                                  type: 'section',
                                  artifactId: artifactNode.artifact.id,
                                  sectionId: sectionNode.section.id,
                                })}
                                className={cn(
                                  'w-full flex items-center gap-1.5 pl-3 pr-2 py-1 text-left text-[11px] transition-colors',
                                  isSectionActive
                                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                )}
                              >
                                <span className="truncate">{sectionNode.label}</span>
                                {sectionNode.isAi && (
                                  <Sparkles className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                                )}
                                {sectionNode.isEdited && (
                                  <User className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
