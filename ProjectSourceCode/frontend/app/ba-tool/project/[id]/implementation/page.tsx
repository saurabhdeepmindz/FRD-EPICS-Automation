'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FolderTree,
  Code2,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Settings,
  KeyRound,
  Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentRunPanel } from '@/components/ba-tool/AgentRunPanel';
import { CodeTasksPanel } from '@/components/ba-tool/CodeTasksPanel';
import { TestsPanel } from '@/components/ba-tool/TestsPanel';
import { UpstreamSyncPanel } from '@/components/ba-tool/UpstreamSyncPanel';
import {
  getImplementation,
  getFolderStatus,
  scaffoldSourceCode,
  seedContext,
  getAgentSettings,
  updateAgentSettings,
  listAgentSkills,
  listCodeModules,
  runDevTests,
  runFtcTests,
  getFtcSummary,
  type ProjectImplementation,
  type FolderStatus,
  type AgentSettingsPublic,
  type AgentProvider,
  type AgentSkill,
  type ProjectReadiness,
  type ModuleReadiness,
} from '@/lib/pipeline-api';
import { FreshnessBanner } from '@/components/ba-tool/FreshnessBanner';

const CONTEXT_FILES = [
  'REQUIREMENTS.md',
  'HLD.md',
  'RTM.md',
  'EPICS.md',
  'USER_STORIES.md',
  'SUBTASKS.md',
  'LLD.md',
];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETE: 'bg-emerald-100 text-emerald-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    GENERATING: 'bg-blue-100 text-blue-700',
    PENDING: 'bg-gray-100 text-gray-500',
    ERROR: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function ImplementationPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [impl, setImpl] = useState<ProjectImplementation | null>(null);
  const [folders, setFolders] = useState<FolderStatus | null>(null);
  const [agent, setAgent] = useState<AgentSettingsPublic | null>(null);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [readiness, setReadiness] = useState<ProjectReadiness | null>(null);
  const [selectedModuleDbId, setSelectedModuleDbId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaffolding, setScaffolding] = useState(false);
  const [refreshingCtx, setRefreshingCtx] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, f, a, s, r] = await Promise.all([
        getImplementation(projectId),
        getFolderStatus(projectId),
        getAgentSettings().catch(() => null),
        listAgentSkills().catch(() => []),
        listCodeModules(projectId).catch(() => null),
      ]);
      setImpl(i);
      setFolders(f);
      setAgent(a);
      setSkills(s);
      setReadiness(r);
      // Auto-select: prefer the first ready module, else the first module.
      setSelectedModuleDbId((prev) => {
        const mods = r?.modules ?? [];
        if (prev && mods.some((m) => m.moduleDbId === prev)) return prev;
        return (mods.find((m) => m.ready) ?? mods[0])?.moduleDbId ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onScaffold = async () => {
    setScaffolding(true);
    setError(null);
    setMsg(null);
    try {
      const r = await scaffoldSourceCode(projectId);
      setMsg(`Scaffolded ${r.filesWritten} files across ${r.modules.length} module(s).`);
      await load();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Scaffold failed'),
      );
    } finally {
      setScaffolding(false);
    }
  };

  const onRefreshContext = async () => {
    setRefreshingCtx(true);
    setError(null);
    setMsg(null);
    try {
      const r = await seedContext(projectId);
      setMsg(`Regenerated ${r?.files.length ?? 0} context files.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Context refresh failed');
    } finally {
      setRefreshingCtx(false);
    }
  };

  const filesPlaced = (impl?.metadata?.filesPlaced as number | undefined) ?? null;

  const selectedModule =
    readiness?.modules.find((m) => m.moduleDbId === selectedModuleDbId) ?? null;

  // Why the skills can't run right now (drives the disabled Run buttons).
  const runDisabledReason: string | undefined = !readiness?.modules.length
    ? 'No modules found for this project.'
    : !selectedModule
      ? 'Select a module to generate code for.'
      : !selectedModule.ready
        ? `${selectedModule.moduleId} is not code-gen-ready — missing: ${selectedModule.missing.join(', ')}`
        : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/ba-tool/project/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Project
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Project Implementation</h1>
          <p className="text-sm text-gray-500">
            Stage 9 · Code scaffold from LLD · Context engineering · /prd + /dev runner
          </p>
        </div>
        <div className="ml-auto">
          <Link href={`/ba-tool/project/${projectId}/hld`}>
            <Button variant="outline" size="sm">← HLD</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <FreshnessBanner projectId={projectId} />
        {msg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800">
            {msg}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {folders && (
              <div className="bg-gray-100 border rounded-lg px-4 py-2 text-xs text-gray-500 font-mono">
                {folders.paths.root}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scaffold */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                    <FolderTree className="h-4 w-4" /> ProjectSourceCode
                    {impl && <StatusPill status={impl.scaffoldStatus} />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-500">
                  <p>Materialised from the LLD pseudo files — each file lands at its declared path, creating the folder tree.</p>
                  {filesPlaced != null && (
                    <p className="text-emerald-700 flex items-center gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" /> {filesPlaced} files placed
                    </p>
                  )}
                  <Button size="sm" className="w-full" onClick={onScaffold} disabled={scaffolding}>
                    {scaffolding ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scaffolding…</>
                    ) : (
                      <><FolderTree className="h-3 w-3 mr-1" /> Scaffold from LLD</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Context engineering */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                    <Code2 className="h-4 w-4" /> Context Engineering
                    {impl && <StatusPill status={impl.contextEngineeringStatus} />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-500">
                    Real artifact content assembled into <code className="text-xs">.context/</code> for /prd + /dev.
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {CONTEXT_FILES.map((f) => (
                      <div key={f} className="flex items-center gap-1 text-xs text-gray-500">
                        <Code2 className="h-3 w-3 text-gray-300" />
                        <span className="font-mono">{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={onRefreshContext} disabled={refreshingCtx}>
                    {refreshingCtx ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Regenerating…</>
                    ) : (
                      <><RefreshCw className="h-3 w-3 mr-1" /> Regenerate Context</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Module selector + readiness gate (Track N) */}
            <ModuleSelector
              readiness={readiness}
              selectedModuleDbId={selectedModuleDbId}
              onSelect={setSelectedModuleDbId}
              selectedModule={selectedModule}
            />

            {/* Task plan (Track O) + /dev execution (Track P) — scoped to the selected module */}
            <CodeTasksPanel
              projectId={projectId}
              moduleDbId={selectedModule?.moduleDbId ?? null}
              moduleLabel={selectedModule ? `${selectedModule.moduleId} · ${selectedModule.moduleName}` : null}
              runDisabledReason={
                runDisabledReason ?? (!agent?.apiKeySet ? 'Configure an Anthropic API key in Agent Settings to run /dev.' : undefined)
              }
            />

            {/* Upstream Sync review (Track P-04/P-05 + J) — dynamic files → upstream */}
            <UpstreamSyncPanel
              projectId={projectId}
              moduleDbId={selectedModule?.moduleDbId ?? null}
            />

            {/* Dev Tests (Track P-03) — Stage 1, separate from FTC */}
            <TestsPanel
              projectId={projectId}
              moduleDbId={selectedModule?.ready ? selectedModule.moduleDbId : null}
              kind="DEV"
              title="Dev Tests"
              description="Unit tests generated/run by /dev during code-gen, executed in ProjectSourceCode/. Shown separately from the FTC Playwright tests below."
              onRun={runDevTests}
              runDisabledReason={runDisabledReason}
            />

            {/* FTC Playwright Tests (Track Q) — Stage 2, separate Run button */}
            <TestsPanel
              projectId={projectId}
              moduleDbId={selectedModule?.ready ? selectedModule.moduleDbId : null}
              kind="FTC"
              title="FTC Playwright Tests"
              description="Playwright tests derived from this module's Functional Test Cases (FTC), executed against ProjectSourceCode/. Separate from the Dev Tests above."
              onRun={runFtcTests}
              runDisabledReason={runDisabledReason}
              loadSummary={async (pid, mid) => {
                const s = await getFtcSummary(pid, mid);
                return `${s.caseCount} FTC case${s.caseCount === 1 ? '' : 's'} · ${s.playwrightCases} with Playwright hints${s.frameworks.length ? ` · frameworks: ${s.frameworks.join(', ')}` : ''}`;
              }}
            />

            {/* Agent settings (K-00) */}
            <AgentSettingsPanel agent={agent} onSaved={load} />

            {/* Skill runner (K-02 registry live; K-03→K-06 streaming/permissions next) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                  <Play className="h-4 w-4" /> Incremental Code Development
                  <span className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                    live
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500">
                  These skills run agentically in <code className="text-xs">ProjectSourceCode/</code>, scoped to the{' '}
                  <strong>selected module</strong> with that module&apos;s context as grounding. Watch live logs, files
                  changing incrementally, and approve permissions right here.
                </p>
                {selectedModule && (
                  <p className="text-xs text-gray-500">
                    Target module:{' '}
                    <span className="font-medium text-gray-700">
                      {selectedModule.moduleId} · {selectedModule.moduleName}
                    </span>
                  </p>
                )}
                {!agent?.apiKeySet && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Configure an Anthropic API key in Agent Settings above before running.
                  </p>
                )}
                <div className="space-y-3">
                  {skills.length === 0 ? (
                    <p className="text-xs text-gray-400">No skills resolved. Check the skill markdown files.</p>
                  ) : (
                    skills.map((s) => (
                      <AgentRunPanel
                        key={s.id}
                        projectId={projectId}
                        skill={s}
                        apiKeySet={!!agent?.apiKeySet}
                        moduleDbId={selectedModule?.ready ? selectedModule.moduleDbId : undefined}
                        disabledReason={runDisabledReason}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Module selector + readiness checklist (Track N) ─────────────────────────

function ModuleSelector({
  readiness,
  selectedModuleDbId,
  onSelect,
  selectedModule,
}: {
  readiness: ProjectReadiness | null;
  selectedModuleDbId: string | null;
  onSelect: (id: string) => void;
  selectedModule: ModuleReadiness | null;
}) {
  if (!readiness) return null;

  const readyCount = readiness.modules.filter((m) => m.ready).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
          <Boxes className="h-4 w-4" /> Module
          <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
            {readyCount}/{readiness.modules.length} ready
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500">
          Code is generated <strong>per module</strong>. A module is selectable only when every upstream artifact
          exists (PRD+FRD, HLD, Wireframes / Screens, EPICs, User Stories, LLD, Sub-Tasks). Visual design counts whether
          it was <em>generated</em> (Discovery wireframes) or came from <em>customer screenshots</em> that went through
          screen analysis.
        </p>

        {readiness.modules.length === 0 ? (
          <p className="text-xs text-gray-400">No modules found for this project.</p>
        ) : (
          <select
            value={selectedModuleDbId ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5"
          >
            {readiness.modules.map((m) => (
              <option key={m.moduleDbId} value={m.moduleDbId}>
                {m.ready ? '● ' : '○ '}
                {m.moduleId} · {m.moduleName}
                {m.ready ? ' — ready' : ` — missing: ${m.missing.join(', ')}`}
              </option>
            ))}
          </select>
        )}

        {/* Readiness checklist for the selected module */}
        {selectedModule && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {selectedModule.moduleId} · {selectedModule.moduleName}
              </span>
              {selectedModule.ready ? (
                <span className="text-[10px] uppercase bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                  ready
                </span>
              ) : (
                <span className="text-[10px] uppercase bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                  blocked
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {selectedModule.gates.map((g) => (
                <div key={`${g.scope}-${g.key}`} className="flex items-center gap-1.5 text-xs">
                  {g.present ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className={g.present ? 'text-gray-600' : 'text-amber-700'}>
                    {g.label}
                    {g.mandatory && <span className="text-red-400" title="mandatory"> *</span>}
                  </span>
                  {g.detail && <span className="text-gray-400">({g.detail})</span>}
                  <span className="text-[10px] text-gray-300 ml-auto">{g.scope}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Agent Settings panel (K-00) ─────────────────────────────────────────────

const PROVIDERS: { value: AgentProvider; label: string }[] = [
  { value: 'claude', label: 'Anthropic Claude (direct)' },
  { value: 'claude-bedrock', label: 'Claude via Amazon Bedrock' },
  { value: 'claude-vertex', label: 'Claude via Google Vertex' },
];

function AgentSettingsPanel({
  agent,
  onSaved,
}: {
  agent: AgentSettingsPublic | null;
  onSaved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(!agent?.apiKeySet);
  const [provider, setProvider] = useState<AgentProvider>(agent?.provider ?? 'claude');
  const [model, setModel] = useState(agent?.model ?? 'claude-sonnet-4-6');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateAgentSettings({ provider, model, apiKey: apiKey || undefined });
      setApiKey('');
      setSaved(true);
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Settings className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Agent Settings</span>
        <span className="text-xs text-gray-400">
          {agent ? `${agent.provider} · ${agent.model}` : ''}
        </span>
        {agent?.apiKeySet ? (
          <span className="ml-auto text-[10px] uppercase bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
            key set {agent.apiKeyHint}
          </span>
        ) : (
          <span className="ml-auto text-[10px] uppercase bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
            no key
          </span>
        )}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 border-t space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <label className="text-xs text-gray-500">
              Provider
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AgentProvider)}
                className="mt-1 w-full text-sm border rounded px-2 py-1.5"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Model
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full text-sm border rounded px-2 py-1.5"
                placeholder="claude-sonnet-4-6"
              />
            </label>
          </div>
          <label className="text-xs text-gray-500 block">
            <span className="flex items-center gap-1">
              <KeyRound className="h-3 w-3" /> API Key {agent?.apiKeySet && '(leave blank to keep current)'}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 w-full text-sm border rounded px-2 py-1.5 font-mono"
              placeholder={agent?.apiKeySet ? `current: ${agent.apiKeyHint}` : 'sk-ant-…'}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…</> : 'Save Settings'}
            </Button>
          </div>
          <p className="text-[11px] text-gray-400">
            The key is stored server-side (gitignored) and never returned to the browser. Used only by the agent runner.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
