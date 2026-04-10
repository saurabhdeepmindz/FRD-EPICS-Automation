'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listBaProjects, createBaProject, type BaProject } from '@/lib/ba-api';
import { MODULE_STATUS_LABELS, MODULE_STATUS_COLORS } from '@/lib/ba-api';
import { Plus, FolderOpen, Loader2, Archive, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BaToolDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<BaProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBaProjects();
      setProjects(data);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !projectCode.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createBaProject({
        name: name.trim(),
        projectCode: projectCode.trim(),
        description: description.trim() || undefined,
      });
      setShowCreate(false);
      setName('');
      setProjectCode('');
      setDescription('');
      router.push(`/ba-tool/project/${project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }, [name, projectCode, description, router]);

  return (
    <main className="min-h-screen bg-background" data-testid="ba-tool-dashboard">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Home
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">BA Automation Tool</h1>
              <p className="text-xs text-muted-foreground">
                Upload Figma screens, generate FRD, EPICs, User Stories & SubTasks
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="btn-new-project">
            <Plus className="h-4 w-4 mr-1" />
            New Project
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Create project modal */}
        {showCreate && (
          <Card className="mb-8" data-testid="create-project-form">
            <CardHeader>
              <CardTitle className="text-base">Create New BA Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Project Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Tax Compass Platform"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    data-testid="input-project-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Project Code *</label>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="e.g., TAXCOMP"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    data-testid="input-project-code"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief project description..."
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={!name.trim() || !projectCode.trim() || creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Create Project
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Loading projects...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="text-center py-20">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No projects yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first BA project to start uploading Figma screens and generating artifacts.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create First Project
            </Button>
          </div>
        )}

        {/* Project grid */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/ba-tool/project/${project.id}`}>
                <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full" data-testid={`project-card-${project.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{project.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{project.projectCode}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        project.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        project.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-500' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                    )}
                    {/* Module badges */}
                    <div className="space-y-1">
                      {project.modules.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No modules yet</p>
                      ) : (
                        project.modules.map((mod) => (
                          <div key={mod.id} className="flex items-center justify-between">
                            <span className="text-xs text-foreground">
                              {mod.moduleId} — {mod.moduleName}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${MODULE_STATUS_COLORS[mod.moduleStatus]}`}>
                              {MODULE_STATUS_LABELS[mod.moduleStatus]}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3">
                      {project.modules.length} module{project.modules.length !== 1 ? 's' : ''} &middot; Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
