'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, Plus, Upload, Loader2, RotateCcw, Trash2, Star, Eye, Save, X,
  FileText, Sparkles, User as UserIcon,
} from 'lucide-react';
import {
  listMasterData,
  createMasterDataEntry,
  archiveMasterDataEntry,
  promoteMasterDataEntry,
  reseedMasterDataCategory,
  dedupeCheck,
  getTemplate,
  getTemplateLineage,
  forkTemplate,
  uploadTemplate,
  CATEGORY_LABELS,
  TECH_STACK_CATEGORIES,
  TEMPLATE_CATEGORIES,
  isTechStackCategory,
  isTemplateCategory,
  type BaMasterDataCategory,
  type BaMasterDataEntry,
  type BaTemplate,
  type FuzzyMatchCandidate,
} from '@/lib/ba-api';
import { cn } from '@/lib/utils';

const ALL_CATEGORIES: BaMasterDataCategory[] = [...TECH_STACK_CATEGORIES, ...TEMPLATE_CATEGORIES];

export default function ArchitectConsolePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [activeCategory, setActiveCategory] = useState<BaMasterDataCategory>('FRONTEND_STACK');
  const [entries, setEntries] = useState<BaMasterDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMasterData(activeCategory, projectId);
      setEntries(data);
      setError(null);
    } catch {
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, projectId]);

  useEffect(() => { load(); }, [load]);

  const isTech = isTechStackCategory(activeCategory);
  const isTmpl = isTemplateCategory(activeCategory);

  const handleArchive = useCallback(async (id: string) => {
    if (!confirm('Archive this entry? It will no longer appear in dropdowns.')) return;
    setBusy(true);
    try {
      await archiveMasterDataEntry(id);
      load();
    } catch {
      alert('Failed to archive');
    } finally {
      setBusy(false);
    }
  }, [load]);

  const handlePromote = useCallback(async (id: string) => {
    if (!confirm('Promote this PROJECT entry to GLOBAL? It will be visible in every project.')) return;
    setBusy(true);
    try {
      await promoteMasterDataEntry(id);
      load();
    } catch {
      alert('Promote failed. Admin flag required.');
    } finally {
      setBusy(false);
    }
  }, [load]);

  const handleReseed = useCallback(async () => {
    if (!isTech) {
      alert('Reseed is only supported for tech-stack categories — templates are UI-uploaded only.');
      return;
    }
    if (!confirm(`Wipe GLOBAL entries for ${CATEGORY_LABELS[activeCategory]} and reload from bundle? PROJECT entries are preserved.`)) return;
    setBusy(true);
    try {
      const result = await reseedMasterDataCategory(activeCategory);
      alert(`Reseeded ${result.seeded} entries.`);
      load();
    } catch (err) {
      alert(`Reseed failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }, [activeCategory, isTech, load]);

  return (
    <div className="flex h-screen flex-col bg-background" data-testid="architect-console-page">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/ba-tool/project/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Architect Console</h1>
            <p className="text-xs text-muted-foreground">Design Standards — tech stack defaults + organisation templates</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav — two grouped tab lists */}
        <aside className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto">
          <CategoryGroup
            label="Tech Stack"
            subtitle="Bundled defaults + inline add"
            categories={TECH_STACK_CATEGORIES}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
          <CategoryGroup
            label="Templates"
            subtitle="Upload-only (no defaults)"
            categories={TEMPLATE_CATEGORIES}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
        </aside>

        {/* Main — entry list for active category */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{CATEGORY_LABELS[activeCategory]}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTech ? 'Tech-stack category. Bundled with sensible defaults; add project-specific values inline.' : 'Template category. Upload one organisation template at a time; nothing is bundled.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isTech && (
                  <>
                    <Button size="sm" variant="outline" onClick={handleReseed} disabled={busy}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reseed from bundle
                    </Button>
                    <Button size="sm" onClick={() => setShowAdd(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add value
                    </Button>
                  </>
                )}
                {isTmpl && (
                  <Button size="sm" onClick={() => setShowUpload(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Upload template
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : entries.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-10 text-center">
                  {isTech ? (
                    <>
                      <p className="text-sm text-muted-foreground">No entries yet.</p>
                      <Button size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add your first value
                      </Button>
                    </>
                  ) : (
                    <>
                      <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No templates uploaded.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Click <strong>Upload template</strong> to add one.</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    onArchive={handleArchive}
                    onPromote={handlePromote}
                    onViewTemplate={(tid) => setEditTemplateId(tid)}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      {showAdd && (
        <AddEntryDialog
          category={activeCategory}
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}
      {showUpload && (
        <UploadTemplateDialog
          category={activeCategory}
          projectId={projectId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); load(); }}
        />
      )}
      {editTemplateId && (
        <TemplateEditorDialog
          templateId={editTemplateId}
          projectId={projectId}
          onClose={() => setEditTemplateId(null)}
          onForked={() => { setEditTemplateId(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Category nav group ─────────────────────────────────────────────────────

function CategoryGroup({ label, subtitle, categories, active, onSelect }: {
  label: string; subtitle: string;
  categories: BaMasterDataCategory[];
  active: BaMasterDataCategory;
  onSelect: (c: BaMasterDataCategory) => void;
}) {
  return (
    <div className="py-3 border-b border-border/60">
      <div className="px-4 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>
      </div>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={cn(
            'w-full text-left px-4 py-2 text-sm transition-colors',
            active === c
              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
              : 'text-foreground hover:bg-muted',
          )}
        >
          {CATEGORY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}

// ─── Entry row ──────────────────────────────────────────────────────────────

function EntryRow({ entry, onArchive, onPromote, onViewTemplate, busy }: {
  entry: BaMasterDataEntry;
  onArchive: (id: string) => void;
  onPromote: (id: string) => void;
  onViewTemplate: (templateId: string) => void;
  busy: boolean;
}) {
  const hasTemplate = Boolean(entry.templateId);
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{entry.name}</span>
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded font-medium',
            entry.scope === 'GLOBAL' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
          )}>
            {entry.scope}
          </span>
          {hasTemplate && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
              Template
            </span>
          )}
          {entry.template?.lastModifiedBy === 'AI' && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">
              <Sparkles className="h-2.5 w-2.5" /> AI-modified
            </span>
          )}
          {entry.template?.lastModifiedBy === 'HUMAN' && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
              <UserIcon className="h-2.5 w-2.5" /> Human-edited
            </span>
          )}
        </div>
        {entry.description && (
          <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
          value={entry.value}
          {entry.template && <> · v{entry.template.version}</>}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {hasTemplate && (
          <Button size="sm" variant="ghost" onClick={() => onViewTemplate(entry.templateId!)} disabled={busy}>
            <Eye className="h-3.5 w-3.5 mr-1" /> View / Edit
          </Button>
        )}
        {entry.scope === 'PROJECT' && (
          <Button size="sm" variant="ghost" onClick={() => onPromote(entry.id)} disabled={busy} title="Promote to Global">
            <Star className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onArchive(entry.id)} disabled={busy} title="Archive">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─── Add-entry dialog (tech-stack values) ───────────────────────────────────

function AddEntryDialog({ category, projectId, onClose, onCreated }: {
  category: BaMasterDataCategory; projectId: string;
  onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<FuzzyMatchCandidate[] | null>(null);

  const handleSave = useCallback(async (force = false) => {
    if (!name.trim() || !value.trim()) return;
    setSaving(true);
    try {
      if (!force) {
        const matches = await dedupeCheck(category, name.trim(), projectId);
        if (matches.length > 0) {
          setSuggestions(matches);
          setSaving(false);
          return;
        }
      }
      await createMasterDataEntry({
        category, scope: 'PROJECT', projectId,
        name: name.trim(), value: value.trim(), description: description.trim() || undefined,
        force,
      });
      onCreated();
    } catch (err) {
      alert(`Create failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [category, projectId, name, value, description, onCreated]);

  return (
    <ModalShell onClose={onClose} title={`Add ${CATEGORY_LABELS[category]}`}>
      <div className="space-y-3">
        <Field label="Name *" value={name} onChange={setName} placeholder={`e.g. Qwik`} />
        <Field label="Value (canonical id) *" value={value} onChange={setValue} placeholder="e.g. qwik" mono />
        <Field label="Description" value={description} onChange={setDescription} multiline placeholder="What is this used for? When to pick it?" />

        {suggestions && suggestions.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium mb-1">Possible duplicate — did you mean?</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {suggestions.map((s) => (
                <li key={s.id}>{s.name} <span className="text-amber-700">({s.scope}, distance {s.distance})</span></li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => { setSuggestions(null); onClose(); }}>Use existing</Button>
              <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>Create anyway</Button>
            </div>
          </div>
        )}

        {!suggestions && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => handleSave(false)} disabled={saving || !name.trim() || !value.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Upload template dialog ─────────────────────────────────────────────────

function UploadTemplateDialog({ category, projectId, onClose, onUploaded }: {
  category: BaMasterDataCategory; projectId: string;
  onClose: () => void; onUploaded: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isProjectStructure = category === 'PROJECT_STRUCTURE';
  const accept = isProjectStructure ? '.zip,application/zip' : '.md,.txt,.py,.ts,.tsx,.js,.jsx,.java,.cs,.go,.rb,text/*';
  const hint = isProjectStructure
    ? 'Upload a .zip of your project structure. Subdirectories become the tree; any sibling .meta text file becomes per-file notes.'
    : 'Upload a single text file (Markdown recommended). Max 1 MB.';

  const submit = useCallback(async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      await uploadTemplate({ file, category, name: name.trim(), description: description.trim() || undefined, scope: 'PROJECT', projectId });
      onUploaded();
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setUploading(false);
    }
  }, [file, name, description, category, projectId, onUploaded]);

  return (
    <ModalShell onClose={onClose} title={`Upload ${CATEGORY_LABELS[category]}`}>
      <div className="space-y-3">
        <Field label="Template name *" value={name} onChange={setName} placeholder="e.g. Acme Corp LLD v1" />
        <Field label="Description" value={description} onChange={setDescription} multiline placeholder="What is this template for?" />
        <div>
          <label className="text-xs font-medium text-muted-foreground">File *</label>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs mt-1 file:mr-3 file:py-1 file:px-2 file:rounded file:border file:border-border file:bg-muted/30 file:text-foreground file:text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={submit} disabled={uploading || !file || !name.trim()}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            Upload
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Template editor (view + fork on save) ─────────────────────────────────

function TemplateEditorDialog({ templateId, projectId, onClose, onForked }: {
  templateId: string; projectId: string;
  onClose: () => void; onForked: () => void;
}) {
  const [template, setTemplate] = useState<BaTemplate | null>(null);
  const [lineage, setLineage] = useState<BaTemplate[]>([]);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const t = await getTemplate(templateId);
        setTemplate(t);
        setContent(t.content);
        setName(t.name);
        const l = await getTemplateLineage(templateId);
        setLineage(l);
      } catch {
        alert('Failed to load template');
      } finally {
        setLoading(false);
      }
    })();
  }, [templateId]);

  const handleFork = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    try {
      await forkTemplate(template.id, { projectId, name, content });
      onForked();
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [template, projectId, name, content, onForked]);

  return (
    <ModalShell onClose={onClose} title={template ? `${template.name} — v${template.version}` : 'Template'} wide>
      {loading || !template ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Lineage */}
          {lineage.length > 1 && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px]">
              <p className="font-medium text-muted-foreground mb-1">Lineage</p>
              <div className="flex items-center gap-1 flex-wrap">
                {lineage.slice().reverse().map((t, i, arr) => (
                  <span key={t.id} className="flex items-center gap-1">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded',
                      t.id === template.id ? 'bg-primary/20 text-primary font-medium' : 'bg-muted text-muted-foreground',
                    )}>
                      v{t.version} · {t.lastModifiedBy}
                    </span>
                    {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Scope:</span> <span className="font-medium">{template.scope}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Version:</span> <span className="font-medium">{template.version}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last modified by:</span> <span className="font-medium">{template.lastModifiedBy}</span>
            </div>
          </div>

          {editing && (
            <Field label="Template name" value={name} onChange={setName} />
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Content</label>
            {editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full mt-1 rounded-md border border-input px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={Math.min(25, Math.max(12, content.split('\n').length + 2))}
              />
            ) : (
              <pre className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono whitespace-pre-wrap max-h-[50vh] overflow-auto">
                {content}
              </pre>
            )}
            {editing && (
              <p className="text-[10px] text-amber-700 mt-1">
                Saving forks a new version (v{template.version + 1}) scoped to this project. The original is preserved unchanged.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {!editing ? (
              <>
                <Button size="sm" onClick={() => setEditing(true)}>Edit (fork new version)</Button>
                <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleFork} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save as v{template.version + 1}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setContent(template.content); setName(template.name); }}>Cancel</Button>
              </>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Shared primitives ──────────────────────────────────────────────────────

function ModalShell({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className={cn('bg-card rounded-lg shadow-2xl border border-border w-full flex flex-col', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-4 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          rows={3} className={cn('w-full mt-1 rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40', mono && 'font-mono text-xs')} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={cn('w-full mt-1 rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40', mono && 'font-mono text-xs')} />
      )}
    </div>
  );
}
