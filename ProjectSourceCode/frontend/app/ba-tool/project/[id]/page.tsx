'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  createBaModule,
  updateBaProject,
  getProjectExecutionHealth,
  getSprintBurndown,
  listSprints,
  projectSwaggerUrl,
  type BaProject,
  type BaExecutionHealth,
  type BaBurndown,
  type BaSprint,
  MODULE_STATUS_LABELS,
  MODULE_STATUS_COLORS,
} from '@/lib/ba-api';
import { BurndownChart } from '@/components/ba-tool/BurndownChart';
import { ArrowLeft, Plus, Loader2, FolderOpen, ChevronRight, BarChart3, List, AlertTriangle, Download, Save, Edit3, Ruler, CheckCircle2, XCircle, Ban, Clock, Bug, CalendarClock, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BaProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [health, setHealth] = useState<BaExecutionHealth | null>(null);
  const [sprints, setSprints] = useState<BaSprint[]>([]);
  const [burndown, setBurndown] = useState<BaBurndown | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [burndownLoading, setBurndownLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create module state
  const [showCreate, setShowCreate] = useState(false);
  const [moduleId, setModuleId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [creating, setCreating] = useState(false);

  // Project metadata edit state
  const [editMeta, setEditMeta] = useState(false);
  const [metaProductName, setMetaProductName] = useState('');
  const [metaClientName, setMetaClientName] = useState('');
  const [metaSubmittedBy, setMetaSubmittedBy] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, h, sp] = await Promise.all([
        getBaProject(projectId),
        getProjectExecutionHealth(projectId).catch(() => null),
        listSprints(projectId).catch(() => [] as BaSprint[]),
      ]);
      setProject(data);
      setHealth(h);
      setSprints(sp);
      // Default to the most recently-started ACTIVE sprint, else none.
      const activeSprints = sp.filter((s) => s.status === 'ACTIVE');
      const defaultSprint = activeSprints
        .slice()
        .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0] ?? null;
      setSelectedSprintId(defaultSprint?.id ?? '');
    } catch {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fetch burndown whenever the selected sprint changes.
  useEffect(() => {
    if (!selectedSprintId) { setBurndown(null); return; }
    let cancelled = false;
    setBurndownLoading(true);
    getSprintBurndown(selectedSprintId)
      .then((b) => { if (!cancelled) setBurndown(b); })
      .catch(() => { if (!cancelled) setBurndown(null); })
      .finally(() => { if (!cancelled) setBurndownLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSprintId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateModule = useCallback(async () => {
    if (!moduleId.trim() || !moduleName.trim() || !packageName.trim()) return;
    setCreating(true);
    try {
      await createBaModule(projectId, {
        moduleId: moduleId.trim(),
        moduleName: moduleName.trim(),
        packageName: packageName.trim(),
      });
      setShowCreate(false);
      setModuleId('');
      setModuleName('');
      setPackageName('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create module');
    } finally {
      setCreating(false);
    }
  }, [moduleId, moduleName, packageName, projectId, load]);

  // Sync metadata edit inputs when project loads or edit opens
  useEffect(() => {
    if (project) {
      setMetaProductName(project.productName ?? '');
      setMetaClientName(project.clientName ?? '');
      setMetaSubmittedBy(project.submittedBy ?? '');
    }
  }, [project]);

  const handleSaveMeta = useCallback(async () => {
    setSavingMeta(true);
    try {
      await updateBaProject(projectId, {
        productName: metaProductName.trim(),
        clientName: metaClientName.trim(),
        submittedBy: metaSubmittedBy.trim(),
      });
      setEditMeta(false);
      load();
    } catch {
      setError('Failed to save project metadata');
    } finally {
      setSavingMeta(false);
    }
  }, [projectId, metaProductName, metaClientName, metaSubmittedBy, load]);

  const metaComplete = Boolean(project?.productName?.trim());

  // Auto-suggest next module ID
  useEffect(() => {
    if (showCreate && project) {
      const nextNum = project.modules.length + 1;
      setModuleId(`MOD-${String(nextNum).padStart(2, '0')}`);
    }
  }, [showCreate, project]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading project...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? 'Project not found'}</p>
        <Button asChild variant="outline"><Link href="/ba-tool">Back</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" data-testid="ba-project-workspace">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/ba-tool">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Projects
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{project.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{project.projectCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild title="Architect Console — design standards & templates">
            <Link href={`/ba-tool/project/${projectId}/master-data`}>
              <Ruler className="h-3.5 w-3.5 mr-1" />
              Architect Console
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/ba-tool/project/${projectId}/sprints`}>
              <CalendarClock className="h-3.5 w-3.5 mr-1" />
              Sprints
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/ba-tool/project/${projectId}/rtm`}>
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              RTM
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            asChild
            title="Live Swagger UI aggregated across every LLD in this project. Auto-generated from pseudo-code. Opens in a new tab."
          >
            <a href={projectSwaggerUrl(projectId)} target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              API Spec
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/ba-tool/project/${projectId}/defects`}>
              <Bug className="h-3.5 w-3.5 mr-1" />
              Defects
              {health && health.openDefects > 0 && (
                <span className={cn(
                  'ml-1 px-1 py-0 rounded text-[9px] font-bold leading-none',
                  health.criticalOpenDefects > 0 ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700',
                )}>
                  {health.openDefects}
                </span>
              )}
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/ba-tool/project/${projectId}/tbd-registry`}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              TBD Registry
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const response = await api.get(`/ba/projects/${projectId}/export/zip`, {
                  responseType: 'blob',
                  timeout: 60_000,
                });
                const blob = new Blob([response.data], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project?.projectCode ?? 'export'}-ba-artifacts.zip`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                alert('Failed to export. Ensure at least one skill has completed.');
              }
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export ZIP
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Module sidebar */}
        <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Modules ({project.modules.length})
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)} title="Add Module">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Module list */}
          <nav className="py-1">
            {project.modules.length === 0 && (
              <div className="px-4 py-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No modules yet</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowCreate(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Module
                </Button>
              </div>
            )}
            {project.modules.map((mod) => (
              <Link
                key={mod.id}
                href={`/ba-tool/project/${projectId}/module/${mod.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors border-b border-border/50"
                data-testid={`module-link-${mod.moduleId}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{mod.moduleId}</span>
                    <span className="text-sm font-medium text-foreground truncate">{mod.moduleName}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-1 ${MODULE_STATUS_COLORS[mod.moduleStatus]}`}>
                    {MODULE_STATUS_LABELS[mod.moduleStatus]}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </nav>
        </aside>

        {/* Right panel */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* Create module form */}
          {showCreate && (
            <Card className="mb-8 max-w-lg" data-testid="create-module-form">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold">Add New Module</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Module ID *</label>
                    <input
                      type="text"
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                      placeholder="MOD-01"
                      className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Package Name *</label>
                    <input
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      placeholder="admin_dashboard"
                      className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Module Name *</label>
                  <input
                    type="text"
                    value={moduleName}
                    onChange={(e) => setModuleName(e.target.value)}
                    placeholder="e.g., Admin Dashboard & Navigation"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateModule} disabled={creating || !moduleId.trim() || !moduleName.trim() || !packageName.trim()}>
                    {creating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                    Create Module
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Welcome panel */}
          {!showCreate && (
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold text-foreground mb-2">Project Workspace</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Select a module from the sidebar to start uploading screens and running the skill chain.
                Each module follows a 6-step process: Screen Upload → Screen Analysis → FRD → EPICs → User Stories → SubTasks.
              </p>

              {/* Project Metadata — required before EPIC generation */}
              <Card className="mb-6" data-testid="project-metadata-card">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Project Metadata</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Captured in generated EPIC / User Story / SubTask documents. <span className="text-red-600">Product Name is required before EPIC generation.</span>
                      </p>
                    </div>
                    {!editMeta && (
                      <Button size="sm" variant="ghost" onClick={() => setEditMeta(true)}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {!metaComplete && !editMeta && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        Please fill in the required fields below before running EPIC generation.
                      </p>
                    </div>
                  )}

                  {editMeta ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Product Name *</label>
                          <input
                            type="text"
                            value={metaProductName}
                            onChange={(e) => setMetaProductName(e.target.value)}
                            placeholder="e.g., [AI] Highway Illumination Black Spot Detection"
                            className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Client Name</label>
                          <input
                            type="text"
                            value={metaClientName}
                            onChange={(e) => setMetaClientName(e.target.value)}
                            placeholder="e.g., Acme Corp"
                            className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Submitted By</label>
                        <input
                          type="text"
                          value={metaSubmittedBy}
                          onChange={(e) => setMetaSubmittedBy(e.target.value)}
                          placeholder="e.g., John Smith"
                          className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta || !metaProductName.trim()}>
                          {savingMeta ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditMeta(false);
                          setMetaProductName(project.productName ?? '');
                          setMetaClientName(project.clientName ?? '');
                          setMetaSubmittedBy(project.submittedBy ?? '');
                        }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Product Name:</span>{' '}
                        <span className={project.productName ? 'text-foreground font-medium' : 'text-red-600 italic'}>
                          {project.productName || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Client Name:</span>{' '}
                        <span className={project.clientName ? 'text-foreground' : 'text-muted-foreground/60 italic'}>
                          {project.clientName || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Submitted By:</span>{' '}
                        <span className={project.submittedBy ? 'text-foreground' : 'text-muted-foreground/60 italic'}>
                          {project.submittedBy || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Project Code:</span>{' '}
                        <span className="font-mono text-foreground">{project.projectCode}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{project.modules.length}</p>
                    <p className="text-xs text-muted-foreground">Modules</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {project.modules.filter((m) => m.moduleStatus === 'APPROVED' || m.moduleStatus === 'SUBTASKS_COMPLETE').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {project.modules.filter((m) => m.moduleStatus !== 'APPROVED' && m.moduleStatus !== 'SUBTASKS_COMPLETE' && m.moduleStatus !== 'DRAFT').length}
                    </p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </CardContent>
                </Card>
              </div>

              {/* Test Execution Health tile */}
              {health && health.total > 0 && (
                <div className="mb-8 rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Test Execution Health</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Pass rate:{' '}
                        <span className={`font-bold ${
                          health.passRate >= 90 ? 'text-green-600' :
                          health.passRate >= 70 ? 'text-amber-600' :
                          health.executed > 0 ? 'text-rose-600' :
                          'text-muted-foreground'
                        }`}>
                          {health.executed > 0 ? `${health.passRate}%` : '—'}
                        </span>
                      </span>
                      {health.lastRunAt && (
                        <span title={new Date(health.lastRunAt).toLocaleString()}>
                          Last run: {new Date(health.lastRunAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stacked bar */}
                  <div className="mb-4 overflow-hidden rounded h-2 bg-muted flex">
                    {(['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'] as const).map((key) => {
                      const pct = health.total > 0 ? (health.counts[key] / health.total) * 100 : 0;
                      if (pct === 0) return null;
                      const color =
                        key === 'PASS' ? 'bg-green-500' :
                        key === 'FAIL' ? 'bg-rose-500' :
                        key === 'BLOCKED' ? 'bg-amber-500' :
                        key === 'SKIPPED' ? 'bg-sky-400' :
                        'bg-muted-foreground/30';
                      return <div key={key} className={color} style={{ width: `${pct}%` }} title={`${key}: ${health.counts[key]}`} />;
                    })}
                  </div>

                  {/* Count pills */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                    <HealthPill icon={CheckCircle2} label="Pass" count={health.counts.PASS} total={health.total} color="green" />
                    <HealthPill icon={XCircle} label="Fail" count={health.counts.FAIL} total={health.total} color="rose" />
                    <HealthPill icon={Ban} label="Blocked" count={health.counts.BLOCKED} total={health.total} color="amber" />
                    <HealthPill icon={Clock} label="Skipped" count={health.counts.SKIPPED} total={health.total} color="sky" />
                    <HealthPill icon={List} label="Not run" count={health.counts.NOT_RUN} total={health.total} color="gray" />
                    <HealthPill icon={Bug} label="Open defects" count={health.openDefects} total={health.openDefects} color="rose" subtitle={health.criticalOpenDefects > 0 ? `${health.criticalOpenDefects} P0/P1` : undefined} />
                  </div>

                  {/* Drill-downs */}
                  {(health.failingTcs.length > 0 || health.blockedTcs.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {health.failingTcs.length > 0 && (
                        <div>
                          <p className="font-semibold text-rose-700 mb-1">Failing tests ({health.counts.FAIL})</p>
                          <ul className="space-y-0.5">
                            {health.failingTcs.map((tc) => (
                              <li key={tc.id}>
                                <Link
                                  href={`/ba-tool/project/${projectId}/module/${tc.moduleDbId}`}
                                  className="hover:underline text-muted-foreground"
                                  title={tc.title}
                                >
                                  <span className="font-mono text-rose-600">{tc.testCaseId}</span>{' '}
                                  <span className="text-muted-foreground">[{tc.moduleId}]</span>{' '}
                                  <span className="text-foreground">{tc.title.length > 60 ? tc.title.slice(0, 60) + '…' : tc.title}</span>
                                </Link>
                              </li>
                            ))}
                            {health.counts.FAIL > health.failingTcs.length && (
                              <li className="text-muted-foreground/70">
                                +{health.counts.FAIL - health.failingTcs.length} more — see RTM (Exec filter = Fail)
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {health.blockedTcs.length > 0 && (
                        <div>
                          <p className="font-semibold text-amber-700 mb-1">Blocked tests ({health.counts.BLOCKED})</p>
                          <ul className="space-y-0.5">
                            {health.blockedTcs.map((tc) => (
                              <li key={tc.id}>
                                <Link
                                  href={`/ba-tool/project/${projectId}/module/${tc.moduleDbId}`}
                                  className="hover:underline text-muted-foreground"
                                  title={tc.title}
                                >
                                  <span className="font-mono text-amber-600">{tc.testCaseId}</span>{' '}
                                  <span className="text-muted-foreground">[{tc.moduleId}]</span>{' '}
                                  <span className="text-foreground">{tc.title.length > 60 ? tc.title.slice(0, 60) + '…' : tc.title}</span>
                                </Link>
                              </li>
                            ))}
                            {health.counts.BLOCKED > health.blockedTcs.length && (
                              <li className="text-muted-foreground/70">
                                +{health.counts.BLOCKED - health.blockedTcs.length} more — see RTM (Exec filter = Blocked)
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sprint Burndown tile */}
              {sprints.length > 0 && (
                <div className="mb-8 rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Sprint Burndown</h3>
                      {burndown && (
                        <span className="text-[10px] text-muted-foreground">
                          {burndown.totalScope > 0
                            ? `${burndown.totalScope - burndown.totals.notRun} of ${burndown.totalScope} tested`
                            : 'No TCs scoped'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSprintId}
                        onChange={(e) => setSelectedSprintId(e.target.value)}
                        className="text-xs border border-input rounded px-2 py-1 bg-background"
                      >
                        <option value="">— pick a sprint —</option>
                        {sprints
                          .slice()
                          .sort((a, b) => {
                            const order = { ACTIVE: 0, PLANNING: 1, COMPLETED: 2, CANCELLED: 3 } as const;
                            return (
                              order[a.status] - order[b.status] ||
                              a.sprintCode.localeCompare(b.sprintCode)
                            );
                          })
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.sprintCode} — {s.name} [{s.status}]
                            </option>
                          ))}
                      </select>
                      <Button size="sm" variant="ghost" asChild className="h-7">
                        <Link href={`/ba-tool/project/${projectId}/sprints`}>
                          Manage →
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {!selectedSprintId ? (
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground italic">
                      {sprints.some((s) => s.status === 'ACTIVE')
                        ? 'Pick a sprint to see burndown.'
                        : 'No active sprint. Mark a sprint ACTIVE to see a live burndown.'}
                    </div>
                  ) : burndownLoading ? (
                    <div className="h-[200px] flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : burndown ? (
                    <>
                      <BurndownChart data={burndown} />
                      <div className="flex items-center gap-2 flex-wrap mt-3 text-[10px]">
                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{burndown.totals.pass} pass</span>
                        <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">{burndown.totals.fail} fail</span>
                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">{burndown.totals.blocked} blocked</span>
                        <span className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-bold">{burndown.totals.skipped} skipped</span>
                        <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">{burndown.totals.notRun} not run</span>
                        {burndown.note && (
                          <span className="text-muted-foreground italic ml-2">{burndown.note}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground italic">
                      Failed to load burndown.
                    </div>
                  )}
                </div>
              )}

              {/* Skill chain diagram */}
              <div className="rounded-lg border border-border bg-muted/30 p-6">
                <h3 className="text-sm font-semibold mb-4">Skill Chain (per module)</h3>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {['Screen Upload', 'SKILL-00\nScreen Analysis', 'SKILL-01-S\nFRD', 'SKILL-02-S\nEPICs', 'SKILL-04\nUser Stories', 'SKILL-05\nSubTasks'].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-3 py-2 rounded-md border border-border bg-card text-center whitespace-pre-line font-medium">
                        {step}
                      </div>
                      {i < 5 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface HealthPillProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  total: number;
  color: 'green' | 'rose' | 'amber' | 'sky' | 'gray';
  subtitle?: string;
}

function HealthPill({ icon: Icon, label, count, total, color, subtitle }: HealthPillProps) {
  const tone = {
    green: 'border-green-200 bg-green-50 text-green-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    gray: 'border-border bg-muted/40 text-muted-foreground',
  }[color];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`rounded border px-2.5 py-2 flex items-center gap-2 ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold leading-none">{count}</span>
          {total > 0 && count !== total && <span className="text-[10px] opacity-60">({pct}%)</span>}
        </div>
        {subtitle && <div className="text-[10px] opacity-80 truncate">{subtitle}</div>}
      </div>
    </div>
  );
}
