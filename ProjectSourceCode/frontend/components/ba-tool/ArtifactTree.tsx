'use client';

import { useEffect, useMemo, useState } from 'react';
import { SKILL_LABELS, listPseudoFilesByArtifact, listTestCasesByArtifact, type BaArtifact, type BaArtifactSection, type BaPseudoFile, type BaSkillExecution, type BaTestCase } from '@/lib/ba-api';
import { parseFrdContent, type ParsedFeature } from '@/lib/frd-parser';
import { parseEpicContent, type EpicSectionId } from '@/lib/epic-parser';
import { ChevronRight, ChevronDown, FileText, Layers, BookOpen, ListChecks, Cog, Sparkles, User, AlertTriangle, Compass, Search, X } from 'lucide-react';
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
  epicSections?: EpicSectionNode[]; // parsed EPIC sections (only for EPIC artifacts)
  epicInternalSections?: EpicSectionNode[]; // internal processing (Step 1, Step 2, ...)
  /** For multi-story USER_STORY artifacts — groups stories by their parent FRD feature. */
  userStoryGroups?: UserStoryFeatureGroup[];
  /** Extra sections that sit alongside the per-feature groups (Coverage Summary, RTM Extension). */
  userStoryExtras?: SectionNode[];
}

interface UserStoryFeatureGroup {
  featureId: string;   // e.g. "F-04-02"
  stories: Array<{
    section: BaArtifactSection;
    usId: string;      // e.g. "US-076"
    title: string;     // parsed from content
    type: 'Frontend' | 'Backend' | 'Integration' | null;
    hasTbd: boolean;
  }>;
}

interface EpicSectionNode {
  id: string; // section ID or internal key
  label: string;
  hasTbd: boolean;
  highlight?: boolean;
  isInternal?: boolean;
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
  const skillOrder = ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04', 'SKILL-05', 'SKILL-06-LLD', 'SKILL-07-FTC'];
  const completedSkills = executions.filter(
    (e) => e.status === 'AWAITING_REVIEW' || e.status === 'APPROVED' || e.status === 'COMPLETED',
  );

  // SKILL-06-LLD and SKILL-07-FTC are optional post-EPIC skills. We render
  // placeholder tree nodes for both once EPICs are complete — even when no
  // artifacts exist yet — so architects can discover them in the tree
  // instead of having to know about the workbench buttons at the top.
  const OPTIONAL_POST_EPIC: Set<string> = new Set(['SKILL-06-LLD', 'SKILL-07-FTC']);
  const epicsComplete = completedSkills.some((e) => e.skillName === 'SKILL-02-S');

  const tree: SkillNode[] = [];

  for (const skillName of skillOrder) {
    const exec = completedSkills.find((e) => e.skillName === skillName);
    const isOptional = OPTIONAL_POST_EPIC.has(skillName);
    // Skip entirely only when: not an optional skill AND no execution exists.
    // Optional skills show as placeholders once EPICs are done.
    if (!exec && !(isOptional && epicsComplete)) continue;

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

      // Parse EPIC sections for TOC
      let epicSections: EpicSectionNode[] | undefined;
      let epicInternalSections: EpicSectionNode[] | undefined;
      if (artifact.artifactType === 'EPIC') {
        const parsedEpic = parseEpicContent(artifact.sections);
        epicSections = parsedEpic.sections.map((s) => ({
          id: s.id,
          label: s.label,
          hasTbd: s.content.includes('TBD-Future'),
          highlight: s.highlight,
        }));
        // Sort internal sections by step number
        const sortedInternal = [...parsedEpic.internalSections].sort((a, b) => {
          const aStep = a.label.match(/^step\s*(\d+)/i);
          const bStep = b.label.match(/^step\s*(\d+)/i);
          if (aStep && bStep) return parseInt(aStep[1]) - parseInt(bStep[1]);
          if (aStep) return -1;
          if (bStep) return 1;
          return a.label.localeCompare(b.label);
        });
        epicInternalSections = sortedInternal.map((s) => ({
          id: s.key,
          label: s.label,
          hasTbd: s.content.includes('TBD-Future'),
          isInternal: true,
        }));
      }

      // USER_STORY: detect multi-story shape and build feature-grouped tree.
      // Story keys match us_NNN_<title> OR user_story_us_NNN. Feature is
      // parsed from the "FRD Feature Reference" line inside the content.
      let userStoryGroups: UserStoryFeatureGroup[] | undefined;
      let userStoryExtras: SectionNode[] | undefined;
      if (artifact.artifactType === 'USER_STORY') {
        const storyRe = /^(?:us_|user_story_us_)(\d+)/;
        const storyRows = artifact.sections
          .map((s) => {
            const m = storyRe.exec(s.sectionKey);
            if (!m) return null;
            return { section: s, usNumber: parseInt(m[1], 10) };
          })
          .filter((x): x is { section: BaArtifactSection; usNumber: number } => x !== null);

        if (storyRows.length >= 2) {
          const groupsMap = new Map<string, UserStoryFeatureGroup>();
          for (const { section, usNumber } of storyRows) {
            const content = section.isHumanModified && section.editedContent ? section.editedContent : section.content;
            // Match across newlines: AI often places the feature id on the
            // line after the "FRD Feature Reference" label. Fallback to the
            // first F-NN-NN anywhere in the story header.
            const anchoredMatch = content.match(/(?:FRD Feature|Feature ID|Feature Reference)[\s\S]{0,200}?(F-\d+-\d+)/i);
            const fallbackMatch = anchoredMatch ?? content.slice(0, 2000).match(/(F-\d+-\d+)/);
            const featureId = anchoredMatch?.[1] ?? fallbackMatch?.[1] ?? 'UNASSIGNED';
            const titleMatch = content.match(/#{1,2}\s*User Story:?\s*(US-\d+[^\n]*)/i);
            const title = section.sectionLabel && /—|\-\s/.test(section.sectionLabel)
              ? section.sectionLabel.replace(/^US-\d+\s*[—-]?\s*/, '')
              : titleMatch
                ? titleMatch[1].replace(/^US-\d+\s*[—-]?\s*/, '').trim()
                : `User Story US-${String(usNumber).padStart(3, '0')}`;
            const usId = `US-${String(usNumber).padStart(3, '0')}`;
            const type: 'Frontend' | 'Backend' | 'Integration' | null =
              /frontend/i.test(title) || /frontend/i.test(content.slice(0, 500)) ? 'Frontend'
                : /backend/i.test(title) || /backend/i.test(content.slice(0, 500)) ? 'Backend'
                  : /integration/i.test(title) || /integration/i.test(content.slice(0, 500)) ? 'Integration'
                    : null;
            const hasTbd = content.includes('TBD-Future');
            const group = groupsMap.get(featureId) ?? { featureId, stories: [] };
            group.stories.push({ section, usId, title, type, hasTbd });
            groupsMap.set(featureId, group);
          }
          // Sort stories inside each group by US number, sort groups by feature id.
          for (const g of groupsMap.values()) {
            g.stories.sort((a, b) => a.usId.localeCompare(b.usId));
          }
          userStoryGroups = Array.from(groupsMap.values()).sort((a, b) => a.featureId.localeCompare(b.featureId));

          // Extras = coverage_summary, rtm_extension, and any empty feature
          // placeholder sections — surface them flat under the artifact
          // (collapsed by default). Story rows are excluded (they live in groups).
          const consumedIds = new Set(storyRows.map((r) => r.section.id));
          userStoryExtras = artifact.sections
            .filter((s) => !consumedIds.has(s.id))
            .filter((s) => s.sectionKey === 'coverage_summary' || s.sectionKey === 'rtm_extension')
            .map((section) => ({
              section,
              label: section.sectionLabel,
              isAi: section.aiGenerated && !section.isHumanModified,
              isEdited: section.isHumanModified,
            }));
        }
      }

      const showRawChildren =
        artifact.artifactType !== 'FRD' && artifact.artifactType !== 'EPIC' &&
        !userStoryGroups; // multi-story USER_STORY uses userStoryGroups instead

      // SUBTASK artifact: the skill emits one empty ST-<id>-<slug> title
      // section followed by a `subtask_header` section that actually holds
      // the 5-13KB body. The tree shouldn't show both — merge each pair into
      // a single node whose label is the ST-* section's label and whose
      // click target is the subtask_header's content row.
      const mergedSubtaskSections = (() => {
        if (artifact.artifactType !== 'SUBTASK') return null;
        const out: BaArtifactSection[] = [];
        const raw = artifact.sections;
        for (let i = 0; i < raw.length; i++) {
          const s = raw[i];
          const next = raw[i + 1];
          // Two heading formats come out of the skill depending on the AI's
          // phrasing:
          //   - st_<usXX>_<type>_<num>_<slug>          (e.g. st_us043_be_01_…)
          //   - subtask_<N>_st_<usXX>_<type>_<num>_<slug>  (numbered variant)
          // Both are empty-content stubs that precede a `subtask_header`
          // row carrying the actual body.
          // A "title stub" section carries no real body — it's just the
          // heading text that precedes the `subtask_header` row. The AI
          // sometimes emits `---` (markdown horizontal rule) or `***` or
          // bare whitespace as filler, so treat any of those as empty too.
          const stubContent = (s.content ?? '').trim();
          const isEmptyLikeContent =
            stubContent.length === 0 ||
            /^[-*_\s]{1,6}$/.test(stubContent) ||
            /^(---|\*\*\*|___)$/.test(stubContent);
          const isTitleStub =
            (/^st_[a-z0-9_]+$/.test(s.sectionKey) || /^subtask_\d+_st_/.test(s.sectionKey)) &&
            s.sectionKey !== 'subtask_header' &&
            isEmptyLikeContent;
          if (isTitleStub && next && next.sectionKey === 'subtask_header') {
            // Keep the subtask_header row (which has the content) but show
            // it under the title stub's label, so the tree reads naturally.
            out.push({ ...next, sectionLabel: s.sectionLabel });
            i++; // consume the paired subtask_header too
            continue;
          }
          // Drop bare `subtask_header` rows that didn't follow a title stub
          // (they'd be orphans with empty-like content). Also drop the empty
          // title stubs when there wasn't a subtask_header after them.
          const currentTrimmed = (s.content ?? '').trim();
          const currentEmptyLike =
            currentTrimmed.length === 0 ||
            /^[-*_\s]{1,6}$/.test(currentTrimmed) ||
            /^(---|\*\*\*|___)$/.test(currentTrimmed);
          if (s.sectionKey === 'subtask_header' && currentEmptyLike) continue;
          if (isTitleStub) continue;
          out.push(s);
        }
        return out;
      })();

      // For FTC artifacts, hide the five sections whose content is now
      // surfaced via the synthetic per-category tree groups. Their raw
      // markdown view is strictly redundant with the structured drill-down.
      const FTC_HIDDEN_SECTION_KEYS = new Set([
        'test_cases_index',
        'functional_test_cases',
        'integration_test_cases',
        'white_box_test_cases',
        'test_case_appendix',
      ]);

      return {
        artifact,
        label: formatArtifactLabel(artifact),
        icon: getArtifactIcon(artifact.artifactType),
        teamBadge,
        statusBadge,
        features,
        epicSections,
        epicInternalSections,
        userStoryGroups,
        userStoryExtras,
        children: showRawChildren
          ? (mergedSubtaskSections ?? artifact.sections)
              .filter((s) =>
                artifact.artifactType !== 'FTC' || !FTC_HIDDEN_SECTION_KEYS.has(s.sectionKey),
              )
              .map((section) => ({
                section,
                label: section.sectionLabel,
                isAi: section.aiGenerated && !section.isHumanModified,
                isEdited: section.isHumanModified,
              }))
          : [],
      };
    });

    tree.push({
      skillName,
      label: SKILL_LABELS[skillName] ?? skillName,
      status: exec?.status ?? 'PENDING',
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
    'SKILL-06-LLD': 'LLD',
    'SKILL-07-FTC': 'FTC',
  };
  const type = typeMap[skillName];
  if (!type) return [];
  // Re-runs of a skill create new BaArtifact rows (versioned history). The
  // tree should surface only the LATEST per artifactId so users don't see
  // stale copies — this was previously showing 3 identical USER_STORY-MOD-04
  // nodes when SKILL-04 had been re-run. LLD + FTC intentionally expose
  // every version because stack-specific LLDs (langchain-v3 etc.) coexist.
  const matching = artifacts.filter((a) => a.artifactType === type);
  if (type === 'LLD' || type === 'FTC') return matching;
  const latestByArtifactId = new Map<string, BaArtifact>();
  const ts = (a: BaArtifact) => (a.createdAt ? new Date(a.createdAt).getTime() : 0);
  for (const a of matching) {
    const prev = latestByArtifactId.get(a.artifactId);
    if (!prev || ts(a) > ts(prev)) {
      latestByArtifactId.set(a.artifactId, a);
    }
  }
  return Array.from(latestByArtifactId.values());
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
  'SKILL-06-LLD': Compass,
  'SKILL-07-FTC': ListChecks,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ArtifactTree({ executions, artifacts, activeNode, onNodeSelect }: ArtifactTreeProps) {
  const tree = buildTree(executions, artifacts);
  const [query, setQuery] = useState('');
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const node of tree) map[node.skillName] = true;
    return map;
  });
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});
  const [expandedPseudo, setExpandedPseudo] = useState<Record<string, boolean>>({});
  const [expandedCategory, setExpandedCategory] = useState<Record<string, boolean>>({});
  // Pseudo files per LLD artifact + test cases per FTC artifact — fetched
  // asynchronously once per artifact on first mount.
  const [pseudoFilesByArtifact, setPseudoFilesByArtifact] = useState<Record<string, BaPseudoFile[]>>({});
  const [testCasesByArtifact, setTestCasesByArtifact] = useState<Record<string, BaTestCase[]>>({});

  // Fetch pseudo files for every LLD artifact so they can appear as tree children.
  useEffect(() => {
    let cancelled = false;
    const lldArtifacts = artifacts.filter((a) => a.artifactType === 'LLD');
    (async () => {
      for (const a of lldArtifacts) {
        if (pseudoFilesByArtifact[a.id]) continue; // already loaded
        try {
          const files = await listPseudoFilesByArtifact(a.id);
          if (cancelled) return;
          setPseudoFilesByArtifact((prev) => ({ ...prev, [a.id]: files }));
        } catch {
          // swallow — tree just won't show pseudo file children for that LLD
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts.map((a) => `${a.id}:${a.artifactType}`).join('|')]);

  // Fetch test cases for every FTC artifact so they can appear as tree children,
  // grouped by category (Functional / Integration / Security / UI / Data /
  // Performance / Accessibility / API) plus a synthetic White-Box bucket.
  useEffect(() => {
    let cancelled = false;
    const ftcArtifacts = artifacts.filter((a) => a.artifactType === 'FTC');
    (async () => {
      for (const a of ftcArtifacts) {
        if (testCasesByArtifact[a.id]) continue;
        try {
          const tcs = await listTestCasesByArtifact(a.id);
          if (cancelled) return;
          setTestCasesByArtifact((prev) => ({ ...prev, [a.id]: tcs }));
        } catch {
          // swallow
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts.map((a) => `${a.id}:${a.artifactType}`).join('|')]);

  // UX3 — filter tree by case-insensitive substring match across skill labels,
  // artifact labels, FRD features, EPIC sections (structural + internal),
  // generic sections, pseudo-file paths, and test-case IDs/titles. When the
  // query is non-empty, skills/artifacts whose subtree contains no match are
  // hidden entirely; remaining nodes are auto-expanded so matches are visible
  // without user clicks.
  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;

  const matchText = (v: string | null | undefined): boolean => !!v && v.toLowerCase().includes(q);

  const artifactMatches = (a: ArtifactNode): boolean => {
    if (matchText(a.label)) return true;
    if (matchText(a.artifact.artifactId)) return true;
    if (matchText(a.teamBadge)) return true;
    if (a.features.some((f) => matchText(f.featureId) || matchText(f.featureName))) return true;
    if (a.children.some((s) => matchText(s.label) || matchText(s.section?.sectionKey))) return true;
    if (a.epicSections?.some((s) => matchText(s.label) || matchText(s.id))) return true;
    if (a.epicInternalSections?.some((s) => matchText(s.label) || matchText(s.id))) return true;
    const pseudos = pseudoFilesByArtifact[a.artifact.id] ?? [];
    if (pseudos.some((p) => matchText(p.path) || matchText(p.language))) return true;
    const tcs = testCasesByArtifact[a.artifact.id] ?? [];
    if (tcs.some((t) => matchText(t.testCaseId) || matchText(t.title) || matchText(t.category))) return true;
    // User Story multi-story artifacts — search feature ids + per-story usId/title/type.
    if (a.userStoryGroups?.some((g) =>
      matchText(g.featureId) ||
      g.stories.some((s) => matchText(s.usId) || matchText(s.title) || matchText(s.type ?? undefined))
    )) return true;
    return false;
  };

  const skillSubtreeMatches = (s: SkillNode): boolean =>
    matchText(s.label) || matchText(s.skillName) || s.artifacts.some(artifactMatches);

  const filteredTree: SkillNode[] = useMemo(() => {
    if (!hasQuery) return tree;
    return tree
      .filter(skillSubtreeMatches)
      .map((s) => ({
        ...s,
        // When the skill itself matches, keep all its artifacts so the user
        // sees the full subtree. Otherwise, keep only artifacts that match.
        artifacts:
          matchText(s.label) || matchText(s.skillName)
            ? s.artifacts
            : s.artifacts.filter(artifactMatches),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, hasQuery, q, pseudoFilesByArtifact, testCasesByArtifact]);

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
      {/* UX3 search box */}
      <div className="px-2 pb-1.5 pt-1 sticky top-0 bg-background z-10 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tree…"
            className="w-full pl-6 pr-7 py-1 text-[11px] border border-input rounded bg-background"
            aria-label="Search artifact tree"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              title="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {hasQuery && (
          <div className="text-[9px] text-muted-foreground mt-1 px-0.5">
            {filteredTree.length === 0
              ? 'No matches'
              : `${filteredTree.reduce((n, s) => n + s.artifacts.length, 0)} artifact(s) across ${filteredTree.length} skill(s)`}
          </div>
        )}
      </div>

      {hasQuery && filteredTree.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] text-muted-foreground italic">
          No tree entries match &ldquo;{query}&rdquo;.
        </div>
      ) : null}

      {filteredTree.map((skillNode, skillIdx) => {
        const skillNum = `${skillIdx + 1}`;
        // UX3: when a query is active, force-expand so matches are visible.
        const isSkillExpanded = hasQuery ? true : (expandedSkills[skillNode.skillName] ?? true);
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
                <span className="text-muted-foreground shrink-0 font-mono text-[11px]">{skillNum}.</span>
                <span className="truncate font-medium">{skillNode.label}</span>
                <span className={cn(
                  'ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                  skillNode.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                  skillNode.status === 'PENDING' ? 'bg-gray-100 text-gray-500' :
                  'bg-amber-100 text-amber-700',
                )}>
                  {skillNode.status === 'APPROVED' ? 'Done' :
                   skillNode.status === 'PENDING' ? 'Optional' :
                   'Review'}
                </span>
              </button>
            </div>

            {/* ── Level 1: Artifacts ── */}
            {isSkillExpanded && (
              <div className="ml-5 border-l border-border/50">
                {skillNode.artifacts.map((artifactNode, artifactIdx) => {
                  const artifactNum = `${skillNum}.${artifactIdx + 1}`;
                  const isArtifactExpanded = hasQuery
                    ? true
                    : (expandedArtifacts[artifactNode.artifact.id] ?? (activeNode?.artifactId === artifactNode.artifact.id));
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
                          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{artifactNum}</span>
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
                          {artifactNode.features.map((feat, featIdx) => {
                            const featNum = `${artifactNum}.${featIdx + 1}`;
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
                                <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{featNum}</span>
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

                      {/* ── Level 2: EPIC Structured Sections (TOC) ── */}
                      {isArtifactExpanded && artifactNode.epicSections && artifactNode.epicSections.length > 0 && (
                        <div className="ml-5 border-l border-border/30">
                          {artifactNode.epicSections.map((sec, secIdx) => {
                            const secNum = `${artifactNum}.${secIdx + 1}`;
                            const isActive = activeNode?.type === 'section'
                              && activeNode.artifactId === artifactNode.artifact.id
                              && activeNode.sectionId === sec.id;
                            return (
                              <button
                                key={sec.id}
                                onClick={() => onNodeSelect({
                                  type: 'section',
                                  artifactId: artifactNode.artifact.id,
                                  sectionId: sec.id,
                                })}
                                className={cn(
                                  'w-full flex items-center gap-1.5 pl-3 pr-2 py-1 text-left text-[11px] transition-colors',
                                  isActive
                                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                )}
                              >
                                <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{secNum}</span>
                                <span className="truncate">{sec.label}</span>
                                {sec.highlight && (
                                  <span className="text-[7px] bg-primary/20 text-primary px-1 rounded shrink-0">Critical</span>
                                )}
                                {sec.hasTbd && (
                                  <span title="TBD-Future"><AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" /></span>
                                )}
                              </button>
                            );
                          })}

                          {/* Internal Processing sub-group */}
                          {artifactNode.epicInternalSections && artifactNode.epicInternalSections.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-border/30">
                              <div className="flex items-center gap-1 pl-3 pr-2 py-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                                <Cog className="h-2.5 w-2.5" />
                                Internal Processing
                              </div>
                              {artifactNode.epicInternalSections.map((sec, intIdx) => {
                                const intNum = `${artifactNum}.i${intIdx + 1}`;
                                const isActive = activeNode?.type === 'section'
                                  && activeNode.artifactId === artifactNode.artifact.id
                                  && activeNode.sectionId === sec.id;
                                return (
                                  <button
                                    key={sec.id}
                                    onClick={() => onNodeSelect({
                                      type: 'section',
                                      artifactId: artifactNode.artifact.id,
                                      sectionId: sec.id,
                                    })}
                                    className={cn(
                                      'w-full flex items-center gap-1.5 pl-5 pr-2 py-1 text-left text-[10px] transition-colors',
                                      isActive
                                        ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                        : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50',
                                    )}
                                  >
                                    <span className="text-muted-foreground/60 shrink-0 font-mono text-[9px]">{intNum}</span>
                                    <span className="truncate">{sec.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Level 2: User Story feature groups + nested stories ── */}
                      {isArtifactExpanded && artifactNode.userStoryGroups && artifactNode.userStoryGroups.length > 0 && (
                        <div className="ml-5 border-l border-border/30">
                          {artifactNode.userStoryGroups.map((group, gIdx) => {
                            const groupNum = `${artifactNum}.${gIdx + 1}`;
                            const isGroupExpanded = expandedArtifacts[`usgroup:${artifactNode.artifact.id}:${group.featureId}`] ?? true;
                            const toggleKey = `usgroup:${artifactNode.artifact.id}:${group.featureId}`;
                            return (
                              <div key={group.featureId}>
                                <div className="flex items-center">
                                  <button
                                    onClick={() => setExpandedArtifacts((p) => ({ ...p, [toggleKey]: !(p[toggleKey] ?? true) }))}
                                    className="pl-2 pr-0 py-1 text-muted-foreground hover:text-foreground"
                                  >
                                    {isGroupExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  </button>
                                  <button
                                    onClick={() => setExpandedArtifacts((p) => ({ ...p, [toggleKey]: !(p[toggleKey] ?? true) }))}
                                    className="flex-1 flex items-center gap-1.5 pl-1 pr-2 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  >
                                    <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{groupNum}</span>
                                    <span className="font-mono text-primary shrink-0">{group.featureId}</span>
                                    <span className="truncate">User Stories</span>
                                    <span className="ml-auto text-[9px] text-muted-foreground/60 shrink-0">{group.stories.length}</span>
                                  </button>
                                </div>
                                {isGroupExpanded && (
                                  <div className="ml-5 border-l border-border/30">
                                    {group.stories.map((story, sIdx) => {
                                      const storyNum = `${groupNum}.${sIdx + 1}`;
                                      const isSectionActive = activeNode?.type === 'section' && activeNode.sectionId === story.section.id;
                                      const typeCls = story.type === 'Frontend' ? 'bg-blue-100 text-blue-700'
                                        : story.type === 'Backend' ? 'bg-purple-100 text-purple-700'
                                        : story.type === 'Integration' ? 'bg-orange-100 text-orange-700'
                                        : '';
                                      return (
                                        <button
                                          key={story.section.id}
                                          onClick={() => onNodeSelect({
                                            type: 'section',
                                            artifactId: artifactNode.artifact.id,
                                            sectionId: story.section.id,
                                          })}
                                          className={cn(
                                            'w-full flex items-center gap-1.5 pl-3 pr-2 py-1 text-left text-[11px] transition-colors',
                                            isSectionActive
                                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                          )}
                                        >
                                          <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{storyNum}</span>
                                          <span className="font-mono text-primary shrink-0">{story.usId}</span>
                                          {story.type && (
                                            <span className={cn('text-[8px] px-1 py-0.5 rounded font-bold shrink-0', typeCls)}>
                                              {story.type.slice(0, 2).toUpperCase()}
                                            </span>
                                          )}
                                          <span className="truncate">{story.title}</span>
                                          {story.hasTbd && (
                                            <span title="TBD-Future"><AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" /></span>
                                          )}
                                          {story.section.isHumanModified && (
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
                          {/* Extras (Coverage Summary, RTM Extension) at bottom */}
                          {artifactNode.userStoryExtras && artifactNode.userStoryExtras.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-border/30">
                              <div className="pl-3 pr-2 py-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                                Artifact Extras
                              </div>
                              {artifactNode.userStoryExtras.map((sectionNode, eIdx) => {
                                const extraNum = `${artifactNum}.e${eIdx + 1}`;
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
                                    <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{extraNum}</span>
                                    <span className="truncate">{sectionNode.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Level 2: Sections (for non-FRD, non-EPIC artifacts) ── */}
                      {isArtifactExpanded && artifactNode.children.length > 0 && (
                        <div className="ml-5 border-l border-border/30">
                          {artifactNode.children.map((sectionNode, childIdx) => {
                            const childNum = `${artifactNum}.${childIdx + 1}`;
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
                                <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{childNum}</span>
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
                          {/* Synthetic "Pseudo-Code Files" node for LLD artifacts.
                              Pseudo files live in a separate table — loaded
                              asynchronously into pseudoFilesByArtifact. Each
                              file appears as its own child node (6.X.Y.Z). */}
                          {artifactNode.artifact.artifactType === 'LLD' && (() => {
                            const pseudoNum = `${artifactNum}.${artifactNode.children.length + 1}`;
                            const artifactDbId = artifactNode.artifact.id;
                            const files = pseudoFilesByArtifact[artifactDbId] ?? [];
                            const isPseudoRootActive = activeNode?.type === 'section'
                              && activeNode.artifactId === artifactDbId
                              && activeNode.sectionId === '__pseudo_code_files__';
                            const isPseudoExpanded = expandedPseudo[artifactDbId] ?? isPseudoRootActive;
                            return (
                              <>
                                <div className="flex items-center">
                                  {files.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedPseudo((p) => ({ ...p, [artifactDbId]: !(p[artifactDbId] ?? isPseudoRootActive) }))}
                                      className="pl-2 pr-0 py-1 text-muted-foreground hover:text-foreground"
                                    >
                                      {isPseudoExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </button>
                                  ) : (
                                    <span className="w-[18px] pl-2" />
                                  )}
                                  <button
                                    onClick={() => {
                                      onNodeSelect({ type: 'section', artifactId: artifactDbId, sectionId: '__pseudo_code_files__' });
                                      if (!isPseudoExpanded) setExpandedPseudo((p) => ({ ...p, [artifactDbId]: true }));
                                    }}
                                    className={cn(
                                      'flex-1 flex items-center gap-1.5 pl-1 pr-2 py-1 text-left text-[11px] transition-colors',
                                      isPseudoRootActive
                                        ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                    )}
                                  >
                                    <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{pseudoNum}</span>
                                    <span className="truncate">Pseudo-Code Files</span>
                                    <Cog className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                                    <span className="ml-auto text-[9px] text-muted-foreground/50 shrink-0">{files.length}</span>
                                  </button>
                                </div>
                                {isPseudoExpanded && files.length > 0 && (
                                  <div className="ml-5 border-l border-border/30">
                                    {files.map((f, fIdx) => {
                                      const fileNum = `${pseudoNum}.${fIdx + 1}`;
                                      const basename = f.path.split('/').pop() ?? 'file';
                                      const isFileActive = activeNode?.type === 'section'
                                        && activeNode.artifactId === artifactDbId
                                        && activeNode.sectionId === `__pseudo_code_files__:${f.id}`;
                                      return (
                                        <button
                                          key={f.id}
                                          onClick={() => onNodeSelect({ type: 'section', artifactId: artifactDbId, sectionId: `__pseudo_code_files__:${f.id}` })}
                                          className={cn(
                                            'w-full flex items-center gap-1.5 pl-3 pr-2 py-1 text-left text-[11px] transition-colors',
                                            isFileActive
                                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                          )}
                                          title={f.path}
                                        >
                                          <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{fileNum}</span>
                                          <span className="truncate">{basename}</span>
                                          {f.isHumanModified && (
                                            <User className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {/* Synthetic Test-Case category groups for FTC artifacts.
                              Test cases live in a separate table — loaded
                              asynchronously into testCasesByArtifact and
                              grouped into 8 canonical categories + a
                              White-Box bucket. Empty buckets are hidden. */}
                          {artifactNode.artifact.artifactType === 'FTC' && (() => {
                            const artifactDbId = artifactNode.artifact.id;
                            const tcs = testCasesByArtifact[artifactDbId] ?? [];
                            if (tcs.length === 0) return null;

                            const CATEGORY_ORDER = [
                              'Functional', 'Integration', 'Security',
                              'UI', 'Data', 'Performance', 'Accessibility', 'API',
                            ];
                            const buckets = new Map<string, BaTestCase[]>();
                            const whiteBox: BaTestCase[] = [];
                            for (const tc of tcs) {
                              if (tc.scope === 'white_box') {
                                whiteBox.push(tc);
                                continue;
                              }
                              const cat = tc.category && CATEGORY_ORDER.includes(tc.category) ? tc.category : 'Functional';
                              if (!buckets.has(cat)) buckets.set(cat, []);
                              buckets.get(cat)!.push(tc);
                            }
                            const orderedGroups: Array<{ key: string; label: string; tcs: BaTestCase[] }> = [];
                            for (const cat of CATEGORY_ORDER) {
                              const bucket = buckets.get(cat);
                              if (bucket && bucket.length > 0) {
                                orderedGroups.push({ key: cat, label: cat, tcs: bucket });
                              }
                            }
                            if (whiteBox.length > 0) {
                              orderedGroups.push({ key: 'white_box', label: 'White-Box', tcs: whiteBox });
                            }

                            return orderedGroups.map((group, gIdx) => {
                              const groupNum = `${artifactNum}.${artifactNode.children.length + gIdx + 1}`;
                              const categoryKey = `${artifactDbId}:${group.key}`;
                              const isAnyTcInGroupActive = activeNode?.type === 'section'
                                && activeNode.artifactId === artifactDbId
                                && activeNode.sectionId?.startsWith('__test_case__')
                                && group.tcs.some((t) => activeNode.sectionId === `__test_case__:${t.id}`);
                              const isExpanded = expandedCategory[categoryKey] ?? isAnyTcInGroupActive;
                              return (
                                <div key={categoryKey}>
                                  <div className="flex items-center">
                                    <button
                                      onClick={() => setExpandedCategory((p) => ({ ...p, [categoryKey]: !(p[categoryKey] ?? isAnyTcInGroupActive) }))}
                                      className="pl-2 pr-0 py-1 text-muted-foreground hover:text-foreground"
                                    >
                                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </button>
                                    <div
                                      className="flex-1 flex items-center gap-1.5 pl-1 pr-2 py-1 text-left text-[11px] text-muted-foreground"
                                    >
                                      <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{groupNum}</span>
                                      <span className="truncate">{group.label} Test Cases</span>
                                      <ListChecks className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                                      <span className="ml-auto text-[9px] text-muted-foreground/50 shrink-0">{group.tcs.length}</span>
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div className="ml-5 border-l border-border/30">
                                      {group.tcs.map((tc, tcIdx) => {
                                        const tcNum = `${groupNum}.${tcIdx + 1}`;
                                        const isTcActive = activeNode?.type === 'section'
                                          && activeNode.artifactId === artifactDbId
                                          && activeNode.sectionId === `__test_case__:${tc.id}`;
                                        return (
                                          <button
                                            key={tc.id}
                                            onClick={() => onNodeSelect({ type: 'section', artifactId: artifactDbId, sectionId: `__test_case__:${tc.id}` })}
                                            className={cn(
                                              'w-full flex items-center gap-1.5 pl-3 pr-2 py-1 text-left text-[11px] transition-colors',
                                              isTcActive
                                                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                            )}
                                            title={tc.title}
                                          >
                                            <span className="text-muted-foreground shrink-0 font-mono text-[9px]">{tcNum}</span>
                                            <span className="font-mono shrink-0 text-primary text-[10px]">{tc.testCaseId}</span>
                                            <span className="truncate">{tc.title}</span>
                                            {/* testKind micro-pill */}
                                            {tc.testKind === 'negative' && (
                                              <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded font-bold shrink-0">NEG</span>
                                            )}
                                            {tc.isIntegrationTest && (
                                              <span className="text-[8px] bg-orange-100 text-orange-700 px-1 rounded font-bold shrink-0">INT</span>
                                            )}
                                            {tc.owaspCategory && (
                                              <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded font-mono shrink-0">{tc.owaspCategory}</span>
                                            )}
                                            {tc.isHumanModified && (
                                              <User className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
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
