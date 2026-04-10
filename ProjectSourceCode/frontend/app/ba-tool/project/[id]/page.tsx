'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  createBaModule,
  type BaProject,
  MODULE_STATUS_LABELS,
  MODULE_STATUS_COLORS,
} from '@/lib/ba-api';
import { ArrowLeft, Plus, Loader2, FolderOpen, ChevronRight, BarChart3, List, AlertTriangle, Download } from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function BaProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create module state
  const [showCreate, setShowCreate] = useState(false);
  const [moduleId, setModuleId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBaProject(projectId);
      setProject(data);
    } catch {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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
          <Button size="sm" variant="outline" asChild>
            <Link href={`/ba-tool/project/${projectId}/rtm`}>
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              RTM
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
