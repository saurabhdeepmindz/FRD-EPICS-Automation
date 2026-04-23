'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText, Loader2, Upload, Sparkles, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/api';
import {
  getArtifact,
  getBaSubTask,
  updateBaProject,
  listPseudoFilesByArtifact,
  downloadPseudoFile,
  downloadPseudoFilesZip,
  downloadProjectStructureZip,
  type BaArtifact,
  type BaArtifactSection,
  type BaSubTask,
  type BaProject,
  type BaPseudoFile,
} from '@/lib/ba-api';
import { MarkdownRenderer } from '@/components/ba-tool/MarkdownRenderer';
import { ScreensGallery, filterReferencedScreens } from '@/components/ba-tool/ScreensGallery';
import { parseFrdContent, type ParsedFeature } from '@/lib/frd-parser';
import { parseEpicContent, sortInternalSections } from '@/lib/epic-parser';
import { STORY_SECTION_CONFIG, CATEGORY_LABELS } from '@/components/ba-tool/UserStoryArtifactView';
import { cn } from '@/lib/utils';

// Internal-processing heuristic (mirrors FrdArtifactView)
const INTERNAL_SECTION_REGEX = /^(step\s*\d+|introduction|output\s*checklist|update\s*compact\s*module\s*index|validate\s*the\s*frd|obtain\s*customer\s*sign[\s-]?off|customer\s*sign[\s-]?off|sign[\s-]?off|definition\s*of\s*done)/i;

interface PreviewSection {
  id: string;
  label: string;
  content: string;
  sectionKey?: string;   // raw BaArtifactSection.sectionKey — used for LLD special cases
  groupLabel?: string;   // e.g. "Story Identity", "EPIC Internal Processing"
  idRef?: string;        // e.g. feature ID shown in tree (F-01-01)
  highlight?: boolean;
  hasTbd?: boolean;
  isAi?: boolean;
  isEdited?: boolean;
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  FRD: 'Functional Requirements Document',
  EPIC: 'EPIC',
  USER_STORY: 'User Story',
  SUBTASK: 'SubTask',
  SCREEN_ANALYSIS: 'Screen Analysis',
  LLD: 'Low-Level Design',
};

interface UnifiedDoc {
  kind: 'artifact' | 'subtask';
  id: string;                  // db id
  artifactId: string;          // human id e.g. FRD-MOD-01
  artifactType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sections: BaArtifactSection[];
  module: { moduleId: string; moduleName: string; packageName: string; screens?: import('@/lib/ba-api').BaScreenLite[] };
  project: Pick<BaProject, 'id' | 'name' | 'projectCode' | 'productName' | 'clientName' | 'submittedBy' | 'clientLogo'>;
}

function normalizeArtifact(a: BaArtifact): UnifiedDoc {
  const mod = a.module;
  return {
    kind: 'artifact',
    id: a.id,
    artifactId: a.artifactId,
    artifactType: a.artifactType,
    status: a.status,
    createdAt: a.createdAt ?? '',
    updatedAt: a.updatedAt ?? '',
    sections: a.sections,
    module: mod
      ? { moduleId: mod.moduleId, moduleName: mod.moduleName, packageName: mod.packageName, screens: mod.screens }
      : { moduleId: '', moduleName: '', packageName: '' },
    project: {
      id: mod?.project?.id ?? '',
      name: mod?.project?.name ?? '',
      projectCode: mod?.project?.projectCode ?? '',
      productName: mod?.project?.productName ?? null,
      clientName: mod?.project?.clientName ?? null,
      submittedBy: mod?.project?.submittedBy ?? null,
      clientLogo: mod?.project?.clientLogo ?? null,
    },
  };
}

function normalizeSubTask(s: BaSubTask): UnifiedDoc {
  const sections: BaArtifactSection[] = (s.sections ?? []).map((sec) => ({
    id: sec.id,
    sectionKey: sec.sectionKey,
    sectionLabel: sec.sectionLabel,
    aiGenerated: true,
    content: sec.aiContent,
    editedContent: sec.editedContent,
    isHumanModified: sec.isHumanModified,
    isLocked: false,
    createdAt: sec.createdAt,
    updatedAt: sec.updatedAt,
  }));
  const m = s.module;
  return {
    kind: 'subtask',
    id: s.id,
    artifactId: s.subtaskId,
    artifactType: 'SUBTASK',
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    sections,
    module: m
      ? { moduleId: m.moduleId, moduleName: m.moduleName, packageName: m.packageName, screens: m.screens }
      : { moduleId: '', moduleName: '', packageName: '' },
    project: {
      id: m?.project?.id ?? '',
      name: m?.project?.name ?? '',
      projectCode: m?.project?.projectCode ?? '',
      productName: m?.project?.productName ?? null,
      clientName: m?.project?.clientName ?? null,
      submittedBy: m?.project?.submittedBy ?? null,
      clientLogo: m?.project?.clientLogo ?? null,
    },
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function fileToResizedDataUri(file: File, maxDim = 400, quality = 0.8): Promise<string> {
  // Compress client-side to keep base64 payload small
  const dataUri: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  // Draw to canvas, scale down if needed
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUri);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png', quality));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUri;
  });
}

export default function BaPreviewPage() {
  const params = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const backHref = search.get('back') ?? '/ba-tool';

  const kind = params.kind === 'subtask' ? 'subtask' : 'artifact';
  const id = params.id;

  const [doc, setDoc] = useState<UnifiedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pseudoFiles, setPseudoFiles] = useState<BaPseudoFile[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === 'subtask') {
        const st = await getBaSubTask(id);
        setDoc(normalizeSubTask(st));
        setPseudoFiles([]);
      } else {
        const a = await getArtifact(id);
        setDoc(normalizeArtifact(a));
        // For LLD artifacts, also fetch pseudo files
        if (a.artifactType === 'LLD') {
          const files = await listPseudoFilesByArtifact(id);
          setPseudoFiles(files);
        } else {
          setPseudoFiles([]);
        }
      }
    } catch {
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => { load(); }, [load]);

  const download = useCallback(async (format: 'pdf' | 'docx') => {
    if (!doc) return;
    setDownloading(format);
    try {
      const base = kind === 'subtask' ? `/ba/subtasks/${id}/export/${format}` : `/ba/artifacts/${id}/export/${format}`;
      const response = await api.get(base, { responseType: 'blob', timeout: 120_000 });
      const type = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const blob = new Blob([response.data], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.artifactId}-${doc.module.moduleId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(`Download failed. Ensure the backend is running.`);
    } finally {
      setDownloading(null);
    }
  }, [kind, id, doc]);

  const viewSource = useCallback(() => {
    const base = kind === 'subtask' ? `/api/ba/subtasks/${id}/preview` : `/api/ba/artifacts/${id}/preview`;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    window.open(`${API_BASE}${base}`, '_blank', 'noopener');
  }, [kind, id]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc?.project.id) return;
    setUploadingLogo(true);
    try {
      const dataUri = await fileToResizedDataUri(file, 400, 0.85);
      await updateBaProject(doc.project.id, { clientLogo: dataUri });
      load();
    } catch {
      alert('Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }, [doc?.project.id, load]);

  // ─── Structured sections per artifact type (mirrors the editor tree) ───
  const previewSections = useMemo<PreviewSection[]>(() => {
    if (!doc) return [];
    const raw = doc.sections;
    const rawForParser = raw.map((s) => ({ sectionKey: s.sectionKey, sectionLabel: s.sectionLabel, content: s.isHumanModified && s.editedContent ? s.editedContent : s.content }));

    // ── FRD: features parsed from content (F-XX-XX) ───────────────────
    if (doc.artifactType === 'FRD') {
      const parsed = parseFrdContent(rawForParser);

      const featureSection = (f: ParsedFeature): PreviewSection => {
        const body: string[] = [];
        if (f.description) body.push(`**Description:** ${f.description}`);
        if (f.priority) body.push(`**Priority:** ${f.priority}`);
        if (f.status) body.push(`**Status:** ${f.status}`);
        if (f.screenRef) body.push(`**Screen Reference:** ${f.screenRef}`);
        if (f.trigger) body.push(`**Trigger:** ${f.trigger}`);
        if (f.preConditions) body.push(`**Pre-conditions:** ${f.preConditions}`);
        if (f.postConditions) body.push(`**Post-conditions:** ${f.postConditions}`);
        if (f.businessRules) body.push(`\n### Business Rules\n${f.businessRules}`);
        if (f.validations) body.push(`\n### Validations\n${f.validations}`);
        if (f.integrationSignals) body.push(`\n### Integration Signals\n${f.integrationSignals}`);
        if (f.acceptanceCriteria) body.push(`\n### Acceptance Criteria\n${f.acceptanceCriteria}`);
        return {
          id: `feature-${f.featureId}`,
          label: f.featureName || f.featureId,
          idRef: f.featureId,
          content: body.join('\n\n') || f.rawBlock,
          hasTbd: f.status.includes('PARTIAL'),
        };
      };

      const out: PreviewSection[] = [];
      // Features (like the tree's F-01-01 .. list)
      for (const feat of parsed.features) out.push(featureSection(feat));
      // Deliverable non-feature sections (Business Rules, Validations, TBD Registry, etc.)
      if (parsed.businessRules) out.push({ id: 'frd-business-rules', label: 'Business Rules', content: parsed.businessRules });
      if (parsed.validations) out.push({ id: 'frd-validations', label: 'Validations', content: parsed.validations });
      if (parsed.tbdFutureRegistry) out.push({ id: 'frd-tbd', label: 'TBD-Future Integration Registry', content: parsed.tbdFutureRegistry, hasTbd: true });
      // Other deliverable sections (skip internal ones)
      for (const s of parsed.otherSections) {
        if (INTERNAL_SECTION_REGEX.test(s.label.trim())) continue;
        out.push({ id: `frd-other-${slugify(s.label)}`, label: s.label, content: s.content });
      }
      // Internal processing group
      const internal = parsed.otherSections.filter((s) => INTERNAL_SECTION_REGEX.test(s.label.trim()));
      for (const s of internal) {
        out.push({ id: `frd-internal-${slugify(s.label)}`, label: s.label, content: s.content, groupLabel: 'FRD Internal Processing' });
      }
      return out;
    }

    // ── EPIC: parsed sections + internal group ────────────────────────
    if (doc.artifactType === 'EPIC') {
      const parsed = parseEpicContent(rawForParser);
      const out: PreviewSection[] = parsed.sections.map((s) => ({
        id: `epic-${s.id}`,
        label: s.label,
        content: s.content,
        highlight: s.highlight,
        hasTbd: s.content.includes('TBD-Future'),
      }));
      const sortedInternal = sortInternalSections(parsed.internalSections);
      for (const s of sortedInternal) {
        out.push({
          id: `epic-internal-${s.key}`,
          label: s.label,
          content: s.content,
          groupLabel: 'EPIC Internal Processing',
        });
      }
      return out;
    }

    // ── User Story: group by STORY_SECTION_CONFIG category ────────────
    if (doc.artifactType === 'USER_STORY') {
      const out: PreviewSection[] = [];
      const categories = ['header', 'flow', 'technical', 'integration', 'testing'] as const;
      // Header fields already shown in the cover — skip them
      const skipKeys = new Set(['1_user_story_id', '2_user_story_name', '3_user_story_description_goal', '7_user_story_type', '8_user_story_status']);
      for (const cat of categories) {
        const group = CATEGORY_LABELS[cat].label;
        for (const s of raw) {
          const cfg = STORY_SECTION_CONFIG[s.sectionKey];
          if (!cfg || cfg.category !== cat) continue;
          if (skipKeys.has(s.sectionKey)) continue;
          const content = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
          out.push({
            id: `story-${s.sectionKey}`,
            label: cfg.label,
            content,
            groupLabel: group,
            hasTbd: content.includes('TBD-Future'),
            isAi: s.aiGenerated && !s.isHumanModified,
            isEdited: s.isHumanModified,
          });
        }
      }
      // Unmatched fallback
      for (const s of raw) {
        if (STORY_SECTION_CONFIG[s.sectionKey] || skipKeys.has(s.sectionKey)) continue;
        if (s.sectionKey.startsWith('us_') || s.sectionKey.includes('user_story')) continue;
        const content = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
        out.push({
          id: `story-${s.sectionKey}`,
          label: s.sectionLabel || s.sectionKey.replace(/_/g, ' '),
          content,
          groupLabel: 'Other Sections',
          isAi: s.aiGenerated && !s.isHumanModified,
          isEdited: s.isHumanModified,
        });
      }
      return out;
    }

    // ── SubTask / Screen Analysis / LLD / other: raw sections 1:1 ─────
    return raw.map((s) => ({
      id: s.id,
      label: s.sectionLabel,
      sectionKey: s.sectionKey,
      content: s.isHumanModified && s.editedContent ? s.editedContent : s.content,
      isAi: s.aiGenerated && !s.isHumanModified,
      isEdited: s.isHumanModified,
    }));
  }, [doc]);

  // Derived data
  const history = useMemo(() => {
    if (!doc) return [];
    return [...doc.sections]
      .filter((s) => s.isHumanModified || s.aiGenerated)
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
      .slice(0, 50)
      .map((s) => ({
        date: s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '',
        section: s.sectionLabel,
        action: s.isHumanModified ? 'Edited' : 'Generated',
        by: s.isHumanModified ? 'Human' : s.aiGenerated ? 'AI' : '—',
      }));
  }, [doc]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading preview...</span>
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? 'Document not found'}</p>
        <Button variant="outline" onClick={() => router.push(backHref)}>Back</Button>
      </div>
    );
  }

  const typeLabel = ARTIFACT_TYPE_LABELS[doc.artifactType] ?? doc.artifactType;
  const productName = doc.project.productName || doc.project.name;
  // Filter screens to only those this artifact references in its content
  const allScreens = doc.module.screens ?? [];
  const referencedScreens = (doc.artifactType === 'FRD' || doc.artifactType === 'EPIC' || doc.artifactType === 'USER_STORY' || doc.artifactType === 'SUBTASK')
    ? filterReferencedScreens(allScreens, doc.sections.map((s) => s.isHumanModified && s.editedContent ? s.editedContent : s.content)).matched
    : [];
  const showScreensBlock = referencedScreens.length > 0;

  return (
    <div className="flex h-screen flex-col bg-muted/30" data-testid="ba-preview-page">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Editor
          </Button>
          <h1 className="text-sm font-semibold truncate">{doc.artifactId} — Preview</h1>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{typeLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider bg-muted px-2 py-1 rounded">{doc.status.replace(/_/g, ' ')}</span>
          <Button size="sm" variant="outline" onClick={viewSource}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            Source
          </Button>
          <Button size="sm" variant="outline" onClick={() => download('pdf')} disabled={downloading !== null}>
            {downloading === 'pdf' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            PDF
          </Button>
          <Button size="sm" onClick={() => download('docx')} disabled={downloading !== null}>
            {downloading === 'docx' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            DOCX
          </Button>
        </div>
      </header>

      {/* Content area: left TOC + scrolling document */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table of Contents</h2>
          </div>
          <nav className="py-2">
            <TocLink href="#cover" label="Cover Page" />
            <TocLink href="#document-history" label="Document History" />
            {showScreensBlock && <TocLink href="#screens" label="Screens" />}
            {pseudoFiles.length > 0 && <TocLink href="#pseudo-files" label={`Pseudo-Code Files (${pseudoFiles.length})`} />}
            <div className="mt-1 border-t border-border/50 pt-1" />
            {renderToc(previewSections)}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-10 py-10 bg-white my-6 rounded-lg shadow-sm border border-border">
            {/* Cover */}
            <section id="cover" className="min-h-[700px] flex flex-col items-center justify-center text-center py-16">
              {/* Logo */}
              <div className="mb-10">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  data-testid="logo-upload-input"
                />
                {doc.project.clientLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doc.project.clientLogo}
                    alt="Client Logo"
                    className="max-h-20 max-w-[200px] object-contain cursor-pointer hover:opacity-80"
                    onClick={() => logoInputRef.current?.click()}
                    title="Click to replace logo"
                  />
                ) : (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="w-56 h-20 border-2 border-dashed border-border rounded-md flex items-center justify-center gap-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                    title="Upload client logo for cover page"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Click to upload Client Logo
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-4">{typeLabel}</div>
              <h1 className="text-2xl font-bold text-foreground">{doc.artifactId}</h1>
              <div className="w-16 h-[3px] bg-primary my-6" />

              <dl className="grid grid-cols-[max-content_1fr] gap-y-2.5 gap-x-6 text-sm text-left mt-6">
                <dt className="text-muted-foreground font-medium">Product Name:</dt>
                <dd className="text-foreground font-medium">{productName}</dd>
                <dt className="text-muted-foreground font-medium">Project Code:</dt>
                <dd className="text-foreground font-mono">{doc.project.projectCode}</dd>
                <dt className="text-muted-foreground font-medium">Module:</dt>
                <dd className="text-foreground">{doc.module.moduleId} — {doc.module.moduleName}</dd>
                <dt className="text-muted-foreground font-medium">Client Name:</dt>
                <dd className="text-foreground">{doc.project.clientName || '—'}</dd>
                <dt className="text-muted-foreground font-medium">Submitted By:</dt>
                <dd className="text-foreground">{doc.project.submittedBy || '—'}</dd>
                <dt className="text-muted-foreground font-medium">Date:</dt>
                <dd className="text-foreground">{new Date(doc.updatedAt || doc.createdAt || Date.now()).toLocaleDateString()}</dd>
                <dt className="text-muted-foreground font-medium">Status:</dt>
                <dd><span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">{doc.status.replace(/_/g, ' ')}</span></dd>
              </dl>
            </section>

            <hr className="my-10 border-border" />

            {/* Document History */}
            <section id="document-history" className="py-8">
              <h2 className="text-lg font-semibold mb-4">Document History</h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No edits or AI generations recorded.</p>
              ) : (
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 border-b border-border font-semibold">Date</th>
                      <th className="text-left px-3 py-2 border-b border-border font-semibold">Section</th>
                      <th className="text-left px-3 py-2 border-b border-border font-semibold">Action</th>
                      <th className="text-left px-3 py-2 border-b border-border font-semibold">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-3 py-2 border-b border-border/50">{h.date}</td>
                        <td className="px-3 py-2 border-b border-border/50">{h.section}</td>
                        <td className="px-3 py-2 border-b border-border/50">{h.action}</td>
                        <td className="px-3 py-2 border-b border-border/50">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                            h.by === 'AI' ? 'bg-blue-100 text-blue-700' : h.by === 'Human' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
                          )}>
                            {h.by === 'AI' ? <Sparkles className="h-3 w-3" /> : h.by === 'Human' ? <UserIcon className="h-3 w-3" /> : null}
                            {h.by}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <hr className="my-10 border-border" />

            {/* Screens block — only those this artifact references */}
            {showScreensBlock && (
              <section id="screens" className="py-6 scroll-mt-4">
                <h2 className="text-lg font-semibold border-b-2 border-primary pb-2 mb-4 flex items-center gap-2">
                  <span>Referenced Screens</span>
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                    {referencedScreens.length} of {allScreens.length}
                  </span>
                </h2>
                <ScreensGallery screens={referencedScreens} />
              </section>
            )}

            {/* Sections — grouped by groupLabel where applicable */}
            {renderBody(previewSections, {
              onDownloadProjectStructure: doc.artifactType === 'LLD' && doc.kind === 'artifact'
                ? () => downloadProjectStructureZip(doc.id, `${doc.artifactId}-project-structure.zip`).catch(() => alert('Download failed'))
                : undefined,
            })}

            {/* Pseudo-code files (LLD only) — positional section, numbered sub-headings */}
            {pseudoFiles.length > 0 && doc.kind === 'artifact' && (() => {
              const sectionNumber = previewSections.length + 1; // positional
              return (
                <section id="pseudo-files" className="py-8 scroll-mt-4">
                  <h2 className="text-lg font-semibold border-b-2 border-primary pb-2 mb-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span>{sectionNumber}. Pseudo-Code Files</span>
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                        {pseudoFiles.length} file{pseudoFiles.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadPseudoFilesZip(doc.id, `${doc.artifactId}-pseudo-files.zip`).catch(() => alert('Download failed'))}
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1"
                      title="Download all files as ZIP (placed in the project structure from Section 16)"
                    >
                      <span>Download all</span>
                    </button>
                  </h2>
                  <ul className="text-xs font-mono mb-4 space-y-0.5 text-foreground">
                    {pseudoFiles.map((f, idx) => (
                      <li key={f.id}>
                        <a className="hover:underline" href={`#pf-${f.id}`}>
                          {sectionNumber}.{idx + 1} {f.path.split('/').pop()}
                        </a>
                        <span className="text-muted-foreground/60 ml-2 text-[10px]">{f.path}</span>
                        {f.isHumanModified && <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Edited</span>}
                      </li>
                    ))}
                  </ul>
                  {pseudoFiles.map((f, idx) => {
                    const content = f.isHumanModified && f.editedContent ? f.editedContent : f.aiContent;
                    const basename = f.path.split('/').pop() ?? 'file.txt';
                    return (
                      <div key={f.id} id={`pf-${f.id}`} className="mb-6 scroll-mt-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h3 className="text-sm font-semibold text-foreground shrink-0">
                              {sectionNumber}.{idx + 1} {basename}
                            </h3>
                            <code className="text-[10px] font-mono text-muted-foreground truncate">{f.path}</code>
                            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase shrink-0">{f.language}</span>
                            {f.isHumanModified && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Edited</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadPseudoFile(f.id, basename).catch(() => alert('Download failed'))}
                            className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted shrink-0 inline-flex items-center gap-1"
                            title={`Download ${basename}`}
                          >
                            <span>Download</span>
                          </button>
                        </div>
                        <pre className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[600px]">
                          {content}
                        </pre>
                      </div>
                    );
                  })}
                </section>
              );
            })()}
          </div>
        </main>
      </div>
    </div>
  );
}

function renderToc(items: PreviewSection[]) {
  // Group by groupLabel (preserves order)
  const out: JSX.Element[] = [];
  let lastGroup: string | undefined = undefined;
  let flatCounter = 0;
  let groupCounter = 0;

  for (const item of items) {
    if (item.groupLabel !== lastGroup) {
      lastGroup = item.groupLabel;
      if (item.groupLabel) {
        out.push(
          <div key={`grp-${item.groupLabel}`} className="mt-3 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-t border-border/50 pt-2">
            {item.groupLabel}
          </div>,
        );
        groupCounter = 0;
      }
    }
    const counter = item.groupLabel ? ++groupCounter : ++flatCounter;
    const label = item.idRef ? `${counter}. ${item.idRef} — ${item.label}` : `${counter}. ${item.label}`;
    out.push(
      <TocLink
        key={item.id}
        href={`#${item.id}`}
        label={label}
        indent
        tone={item.isEdited ? 'edited' : item.isAi ? 'ai' : 'default'}
        hasTbd={item.hasTbd}
        highlight={item.highlight}
      />,
    );
  }
  return out;
}

interface RenderBodyOptions {
  /** Called when the "Download structure" button on the Project Structure section is clicked. */
  onDownloadProjectStructure?: () => void;
}

function renderBody(items: PreviewSection[], opts: RenderBodyOptions = {}) {
  const out: JSX.Element[] = [];
  let lastGroup: string | undefined = undefined;
  let flatCounter = 0;
  let groupCounter = 0;

  for (const item of items) {
    if (item.groupLabel !== lastGroup) {
      lastGroup = item.groupLabel;
      if (item.groupLabel) {
        out.push(
          <div key={`grp-body-${item.groupLabel}`} className="mt-10 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              {item.groupLabel}
            </h2>
          </div>,
        );
        groupCounter = 0;
      }
    }
    const counter = item.groupLabel ? ++groupCounter : ++flatCounter;
    const heading = item.idRef ? `${counter}. ${item.idRef} — ${item.label}` : `${counter}. ${item.label}`;

    // Project Structure section gets a "Download structure" button in its heading
    const isProjectStructure = item.sectionKey === 'project_structure'
      || /^project\s*structure$/i.test(item.label);
    const showStructureDownload = isProjectStructure && opts.onDownloadProjectStructure;

    out.push(
      <section key={item.id} id={item.id} className="py-6 scroll-mt-4">
        <h2 className={cn(
          'text-lg font-semibold border-b-2 pb-2 mb-4 flex items-center justify-between gap-2',
          item.highlight ? 'border-primary' : 'border-primary/60',
        )}>
          <span className="flex items-center gap-2 flex-wrap">
            <span>{heading}</span>
            {item.isAi && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">AI</span>}
            {item.isEdited && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Edited</span>}
            {item.highlight && <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Automation Critical</span>}
            {item.hasTbd && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">TBD-Future</span>}
          </span>
          {showStructureDownload && (
            <button
              type="button"
              onClick={opts.onDownloadProjectStructure}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              title="Download this tree as a ZIP of empty folders + placeholder files"
            >
              Download structure
            </button>
          )}
        </h2>
        <div className={cn('text-sm', item.isAi ? 'text-blue-700' : 'text-foreground')}>
          <MarkdownRenderer content={item.content || ''} />
        </div>
      </section>,
    );
  }
  return out;
}

function TocLink({ href, label, indent = false, tone = 'default', hasTbd, highlight }: { href: string; label: string; indent?: boolean; tone?: 'default' | 'ai' | 'edited'; hasTbd?: boolean; highlight?: boolean }) {
  return (
    <a
      href={href}
      className={cn(
        'block px-4 py-1.5 text-[13px] transition-colors hover:bg-muted',
        indent ? 'pl-6 text-muted-foreground' : 'font-medium text-foreground',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="truncate">{label}</span>
        {highlight && <span className="text-[8px] bg-primary/20 text-primary px-1 rounded shrink-0">★</span>}
        {hasTbd && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded shrink-0">TBD</span>}
        {tone === 'ai' && <Sparkles className="h-2.5 w-2.5 text-blue-500 shrink-0" />}
        {tone === 'edited' && <UserIcon className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
      </span>
    </a>
  );
}
