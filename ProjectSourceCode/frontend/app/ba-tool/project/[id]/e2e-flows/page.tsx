'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Workflow, Plus, Trash2, Loader2, Save, Wand2, Network, GitBranch,
  AlertTriangle, ChevronRight, ChevronDown, RefreshCw, CheckCircle2, Layers,
  Upload, Download, Image as ImageIcon, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listCodeModules,
  listE2eFlows, getE2eFlow, createE2eFlow, deleteE2eFlow, upsertE2eStep, deleteE2eStep,
  getE2eConfig, updateE2eConfig, generateE2eFlows,
  listIntegrations, upsertIntegration, deleteIntegration, seedIntegrationsFromHld,
  elaborateE2eStage, getE2eGaps, E2E_STAGES, syncE2eMappings, buildE2eDiagrams,
  getE2eTestPlan, runE2eTests, importE2eFlows,
  listModuleScreens, getModuleScreenImage, uploadStepScreenshot, clearStepScreenshot,
  type E2eFlow, type E2eFlowStep, type E2eFlowConfig, type ThirdPartyIntegration,
  type E2eNodeType, type ModuleReadiness, type E2eStage, type StepGap,
  type E2eTestPlan, type E2eRunResult, type ModuleScreenRef,
} from '@/lib/pipeline-api';
import { FreshnessBanner } from '@/components/ba-tool/FreshnessBanner';

const NODE_TYPES: E2eNodeType[] = ['START', 'STEP', 'DECISION', 'JOIN', 'END'];
const LAYERS = ['UI', 'API', 'DB', 'Integration'];
const CATEGORIES = ['PAYMENT', 'SMS_OTP', 'EMAIL', 'AUTH', 'WEBHOOK', 'OTHER'];

function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : fallback)
  );
}

export default function E2eFlowsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [modules, setModules] = useState<ModuleReadiness[]>([]);
  const [flows, setFlows] = useState<E2eFlow[]>([]);
  const [config, setConfig] = useState<E2eFlowConfig | null>(null);
  const [integrations, setIntegrations] = useState<ThirdPartyIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f, c, i] = await Promise.all([
        listCodeModules(projectId).catch(() => null),
        listE2eFlows(projectId).catch(() => []),
        getE2eConfig(projectId).catch(() => null),
        listIntegrations(projectId).catch(() => []),
      ]);
      setModules(r?.modules ?? []);
      setFlows(f);
      setConfig(c);
      setIntegrations(i);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const moduleName = (dbId: string | null) =>
    dbId ? modules.find((m) => m.moduleDbId === dbId)?.moduleId ?? '?' : '—';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/ba-tool/project/${projectId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Project</Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Workflow className="h-5 w-5 text-indigo-500" /> E2E Flows
          </h1>
          <p className="text-sm text-gray-500">Cross-module, role-based customer journeys (decision-graph) · before EPICs</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <FreshnessBanner projectId={projectId} artifactType="E2E_FLOW" />
        {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800">{msg}</div>}
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
            <ConfigPanel
              projectId={projectId}
              config={config}
              onSaved={(c) => { setConfig(c); setMsg('Config saved.'); }}
              onGenerated={async (n) => { setMsg(`Generated ${n} flow(s).`); await load(); }}
              onError={setError}
            />
            <IntegrationsPanel
              projectId={projectId}
              integrations={integrations}
              onChange={async () => setIntegrations(await listIntegrations(projectId).catch(() => []))}
              onError={setError}
            />
            <FlowsPanel
              projectId={projectId}
              flows={flows}
              modules={modules}
              moduleName={moduleName}
              integrations={integrations}
              onIntegrationsChange={async () => setIntegrations(await listIntegrations(projectId).catch(() => []))}
              onChange={async () => setFlows(await listE2eFlows(projectId).catch(() => []))}
              onError={setError}
              onMsg={setMsg}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Config + Generate ───────────────────────────────────────────────────────

function ConfigPanel({
  projectId, config, onSaved, onGenerated, onError,
}: {
  projectId: string;
  config: E2eFlowConfig | null;
  onSaved: (c: E2eFlowConfig) => void;
  onGenerated: (n: number) => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const [refJourneys, setRefJourneys] = useState((config?.referenceJourneys ?? []).join(', '));
  const [roles, setRoles] = useState((config?.defaultRoles ?? []).join(', '));
  const [narrative, setNarrative] = useState(config?.narrative ?? '');
  const [targetEnv, setTargetEnv] = useState(config?.targetEnv ?? '');
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const c = await updateE2eConfig(projectId, {
        referenceJourneys: refJourneys.split(',').map((s) => s.trim()).filter(Boolean),
        defaultRoles: roles.split(',').map((s) => s.trim()).filter(Boolean),
        narrative: narrative || undefined,
        targetEnv: targetEnv || undefined,
        baseUrl: baseUrl || undefined,
      });
      onSaved(c);
    } catch (err) { onError(errMsg(err, 'Save failed')); } finally { setSaving(false); }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await generateE2eFlows(projectId);
      await onGenerated(r.flowsCreated);
    } catch (err) { onError(errMsg(err, 'Generation failed (needs ai-service + key)')); } finally { setGenerating(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
          <Wand2 className="h-4 w-4" /> Config & Generation
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="outline" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" /> Save</>}
            </Button>
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</> : <><Wand2 className="h-3 w-3 mr-1" /> Generate Flows</>}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className="text-xs text-gray-500">Configure the journey context, then generate cross-module E2E flows from the FRD (needs the ai-service + an OpenAI key). You can also build flows manually below.</p>
        <Field label="Reference journeys (comma-sep)" value={refJourneys} onChange={setRefJourneys} placeholder="checkout, fund-transfer, signup" />
        <Field label="Default roles / personas (comma-sep)" value={roles} onChange={setRoles} placeholder="Customer, Admin, Guest" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Target env" value={targetEnv} onChange={setTargetEnv} placeholder="staging | uat" />
          <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://…" />
        </div>
        <label className="text-xs text-gray-500 block">
          Narrative
          <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={2}
            className="mt-1 w-full text-sm border rounded px-2 py-1.5" placeholder="Any extra journey context for the generator…" />
        </label>
      </CardContent>
    </Card>
  );
}

// ─── Integrations ──────────────────────────────────────────────────────────────

function IntegrationsPanel({
  projectId, integrations, onChange, onError,
}: {
  projectId: string;
  integrations: ThirdPartyIntegration[];
  onChange: () => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const [seeding, setSeeding] = useState(false);
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState('PAYMENT');

  const seed = async () => {
    setSeeding(true);
    try { await seedIntegrationsFromHld(projectId); await onChange(); }
    catch (err) { onError(errMsg(err, 'Seed failed')); } finally { setSeeding(false); }
  };
  const add = async () => {
    if (!vendor.trim()) return;
    try { await upsertIntegration(projectId, { vendorName: vendor.trim(), category }); setVendor(''); await onChange(); }
    catch (err) { onError(errMsg(err, 'Add failed')); }
  };
  const remove = async (id: string) => {
    try { await deleteIntegration(projectId, id); await onChange(); }
    catch (err) { onError(errMsg(err, 'Delete failed')); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
          <Network className="h-4 w-4" /> 3rd-Party Integrations
          <span className="text-[10px] uppercase bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{integrations.length}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={seed} disabled={seeding}>
            {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Seed from HLD</>}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-gray-500">Payment / OTP / email / auth services the journeys touch. Auto-seeded from the HLD integrations section; editable.</p>
        <div className="space-y-1">
          {integrations.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1">
              <span className="font-medium text-gray-700">{i.vendorName}</span>
              <span className="text-[10px] uppercase bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">{i.category}</span>
              {i.source && <span className="text-[10px] text-gray-400">via {i.source}</span>}
              <button onClick={() => remove(i.id)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {integrations.length === 0 && <p className="text-xs text-gray-400">None yet — seed from HLD or add below.</p>}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor (Stripe, Twilio…)" className="text-xs border rounded px-2 py-1 flex-1" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-xs border rounded px-1.5 py-1">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Flows + step (decision-graph) editor ──────────────────────────────────────

function FlowsPanel({
  projectId, flows, modules, moduleName, integrations, onIntegrationsChange, onChange, onError, onMsg,
}: {
  projectId: string;
  flows: E2eFlow[];
  modules: ModuleReadiness[];
  moduleName: (dbId: string | null) => string;
  integrations: ThirdPartyIntegration[];
  onIntegrationsChange: () => void | Promise<void>;
  onChange: () => void | Promise<void>;
  onError: (m: string) => void;
  onMsg: (m: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<E2eFlow | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [syncing, setSyncing] = useState(false);

  const syncMappings = async () => {
    setSyncing(true);
    try {
      const r = await syncE2eMappings(projectId);
      onMsg(`Mappings synced: ${r.artifactsStamped} artifact section(s) stamped, ${r.rtmRowsUpdated} RTM row(s) updated${r.artifactSectionsRemoved ? `, ${r.artifactSectionsRemoved} stale removed` : ''}.`);
    } catch (err) { onError(errMsg(err, 'Sync failed')); } finally { setSyncing(false); }
  };

  const openFlow = async (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(await getE2eFlow(projectId, id).catch(() => null));
  };
  const refreshDetail = async (id: string) => setDetail(await getE2eFlow(projectId, id).catch(() => null));

  const create = async () => {
    const name = newName.trim();
    if (!name) { onError('Enter a flow name (the key is auto-filled if left blank).'); return; }
    // Auto-derive flowKey from the name when blank: "login" → "E2E-LOGIN".
    const key = (newKey.trim() || `E2E-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`).slice(0, 40);
    try { await createE2eFlow(projectId, { flowKey: key, flowName: name }); setNewKey(''); setNewName(''); await onChange(); }
    catch (err) { onError(errMsg(err, 'Create failed')); }
  };
  const remove = async (id: string) => {
    try { await deleteE2eFlow(projectId, id); if (openId === id) { setOpenId(null); setDetail(null); } await onChange(); }
    catch (err) { onError(errMsg(err, 'Delete failed')); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
          <GitBranch className="h-4 w-4" /> Flows
          <span className="text-[10px] uppercase bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{flows.length}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={syncMappings} disabled={syncing || flows.length === 0}
            title="Stamp e2e_flow_mapping sections onto EPIC/Story/Subtask/LLD/FTC artifacts + RTM">
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Layers className="h-3 w-3 mr-1" /> Sync to artifacts</>}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {flows.map((f) => (
          <div key={f.id} className="border rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => openFlow(f.id)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                {openId === f.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <span className="text-[10px] font-mono text-gray-400">{f.flowKey}</span>
                <span className="text-sm text-gray-800 truncate">{f.flowName}</span>
                {f.journeyType && <span className="text-[10px] uppercase bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{f.journeyType}</span>}
                <span className="text-[10px] text-gray-400">{f._count?.steps ?? f.steps?.length ?? 0} steps</span>
                <span className="text-[10px] text-gray-400">{f.spannedModuleIds.length} modules</span>
              </button>
              <button onClick={() => remove(f.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {openId === f.id && detail && (
              <StepEditor projectId={projectId} flow={detail} modules={modules} moduleName={moduleName}
                integrations={integrations} onIntegrationsChange={onIntegrationsChange}
                onChanged={() => refreshDetail(f.id)} onError={onError} />
            )}
          </div>
        ))}
        {flows.length === 0 && <p className="text-xs text-gray-400">No flows yet. Generate from the FRD above, or create one manually.</p>}

        <div className="flex items-center gap-1.5 pt-1 border-t mt-1">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key — optional (auto from name)" className="text-xs border rounded px-2 py-1 w-44" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} placeholder="Flow name (required)" className="text-xs border rounded px-2 py-1 flex-1" />
          <Button size="sm" variant="outline" onClick={create} disabled={!newName.trim()}><Plus className="h-3 w-3 mr-1" /> Add flow</Button>
        </div>

        <ImportBar projectId={projectId} onMsg={onMsg} onError={onError} onChange={onChange} />
      </CardContent>
    </Card>
  );
}

// ─── CSV import ──────────────────────────────────────────────────────────────

const IMPORT_COLUMNS = ['flowKey', 'flowName', 'journeyType', 'primaryRole', 'stepId', 'sequenceNum', 'nodeType', 'moduleId', 'screenId', 'role', 'triggerLabel', 'outcome', 'condition', 'layer', 'nextStepIds', 'branchLabels', 'integration'];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = '', inQ = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); if (cur.some((x) => x.trim())) rows.push(cur); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

function downloadTemplate() {
  const sample = [
    IMPORT_COLUMNS.join(','),
    ',Login Journey,UI,Customer,S01,1,START,MOD-01,SCR-01,Customer,Launch app,,,UI,S02,,',
    ',Login Journey,,,S02,2,DECISION,MOD-01,SCR-02,Customer,Enter OTP,,if OTP valid,Integration,S03;S01,S03=valid;S01=invalid,Twilio',
    ',Login Journey,,,S03,3,END,MOD-02,,Customer,,Logged in,,UI,,,',
  ].join('\n');
  const blob = new Blob([sample], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'e2e-flows-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

function ImportBar({ projectId, onMsg, onError, onChange }: { projectId: string; onMsg: (m: string) => void; onError: (m: string) => void; onChange: () => void | Promise<void> }) {
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) { onError('No rows found in the file.'); return; }
      const r = await importE2eFlows(projectId, rows);
      onMsg(`Imported ${r.flowsImported} flow(s), ${r.stepsImported} step(s)${r.integrationsAdded ? `, ${r.integrationsAdded} integration(s)` : ''}.${r.errors.length ? ` ${r.errors.length} error(s).` : ''}`);
      if (r.errors.length) onError(r.errors.join(' · '));
      await onChange();
    } catch (err) {
      onError(errMsg(err, 'Import failed'));
    } finally { setImporting(false); }
  };

  return (
    <div className="flex items-center gap-2 pt-2 border-t text-[11px] text-gray-500">
      <span>Bulk import (Excel → Save As CSV):</span>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => inputRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3 mr-1" /> Import CSV</>}
      </Button>
      <button onClick={downloadTemplate} className="text-indigo-600 hover:underline inline-flex items-center gap-1">
        <Download className="h-3 w-3" /> template
      </button>
      <span className="text-gray-400">one row per step; rows sharing a name = one flow</span>
    </div>
  );
}

interface DraftStep {
  stepId: string;
  nodeType: E2eNodeType;
  moduleDbId: string;
  screenId: string;
  role: string;
  triggerLabel: string;
  outcome: string;
  condition: string;
  layer: string;
  thirdPartyIntegrationId: string;
  edges: { nextStepId: string; label: string }[];
}

const EMPTY_DRAFT: DraftStep = {
  stepId: '', nodeType: 'STEP', moduleDbId: '', screenId: '', role: '',
  triggerLabel: '', outcome: '', condition: '', layer: '', thirdPartyIntegrationId: '', edges: [],
};

function StepEditor({
  projectId, flow, modules, moduleName, integrations, onIntegrationsChange, onChanged, onError,
}: {
  projectId: string;
  flow: E2eFlow;
  modules: ModuleReadiness[];
  moduleName: (dbId: string | null) => string;
  integrations: ThirdPartyIntegration[];
  onIntegrationsChange: () => void | Promise<void>;
  onChanged: () => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState<DraftStep>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  // Screenshot chosen in the form before the step is saved (uploaded on Save).
  const [pendingShot, setPendingShot] = useState<File | null>(null);
  const steps = (flow.steps ?? []).slice().sort((a, b) => a.sequenceNum - b.sequenceNum);
  const editingStep = steps.find((s) => s.stepId === draft.stepId);

  const resetDraft = () => { setDraft(EMPTY_DRAFT); setPendingShot(null); };

  const editStep = (s: E2eFlowStep) => {
    setPendingShot(null);
    setDraft({
      stepId: s.stepId, nodeType: s.nodeType, moduleDbId: s.moduleDbId ?? '', screenId: s.screenId ?? '',
      role: s.role ?? '', triggerLabel: s.triggerLabel ?? '', outcome: s.outcome ?? '', condition: s.condition ?? '',
      layer: s.layer ?? '', thirdPartyIntegrationId: s.thirdPartyIntegrationId ?? '',
      edges: (s.nextStepIds ?? []).map((n) => ({ nextStepId: n, label: s.branchLabels?.[n] ?? '' })),
    });
  };

  const save = async () => {
    if (!draft.stepId.trim()) return;
    const stepId = draft.stepId.trim();
    setSaving(true);
    try {
      const branchLabels: Record<string, string> = {};
      for (const e of draft.edges) if (e.nextStepId.trim() && e.label.trim()) branchLabels[e.nextStepId.trim()] = e.label.trim();
      await upsertE2eStep(projectId, flow.id, {
        stepId,
        sequenceNum: steps.find((s) => s.stepId === draft.stepId)?.sequenceNum ?? steps.length + 1,
        nodeType: draft.nodeType,
        nextStepIds: draft.edges.map((e) => e.nextStepId.trim()).filter(Boolean),
        branchLabels: Object.keys(branchLabels).length ? branchLabels : undefined,
        moduleDbId: draft.moduleDbId || undefined,
        screenId: draft.screenId || undefined,
        role: draft.role || undefined,
        triggerLabel: draft.triggerLabel || undefined,
        outcome: draft.outcome || undefined,
        condition: draft.condition || undefined,
        // Picking an integration implies the Integration layer.
        layer: (draft.thirdPartyIntegrationId ? 'Integration' : draft.layer) || undefined,
        thirdPartyIntegrationId: draft.thirdPartyIntegrationId || undefined,
      } as Partial<E2eFlowStep>);
      // The step now exists — upload any screenshot held in the form.
      if (pendingShot) await uploadStepScreenshot(projectId, flow.id, stepId, pendingShot);
      resetDraft();
      await onChanged();
    } catch (err) { onError(errMsg(err, 'Step save failed')); } finally { setSaving(false); }
  };
  const removeStep = async (stepId: string) => {
    try { await deleteE2eStep(projectId, flow.id, stepId); await onChanged(); }
    catch (err) { onError(errMsg(err, 'Step delete failed')); }
  };

  const setEdge = (i: number, field: 'nextStepId' | 'label', v: string) =>
    setDraft((d) => ({ ...d, edges: d.edges.map((e, idx) => idx === i ? { ...e, [field]: v } : e) }));

  return (
    <div className="border-t px-3 py-3 space-y-3 bg-gray-50/50">
      {/* existing steps */}
      <div className="space-y-1">
        {steps.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1">
            <span className="font-mono text-gray-400 w-10">{s.stepId}</span>
            <span className={`text-[9px] uppercase rounded px-1 py-0.5 ${s.nodeType === 'DECISION' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{s.nodeType}</span>
            <span className="text-gray-700 truncate flex-1">{s.triggerLabel || s.outcome || '—'}</span>
            <span className="text-[10px] text-indigo-600">{moduleName(s.moduleDbId)}</span>
            {s.layer && <span className="text-[10px] text-gray-400">{s.layer}</span>}
            {s.thirdPartyIntegrationId && <span className="text-[10px] text-purple-600">⚡{integrations.find((i) => i.id === s.thirdPartyIntegrationId)?.vendorName ?? 'integration'}</span>}
            {s.nextStepIds.length > 0 && <span className="text-[10px] text-gray-400">→ {s.nextStepIds.join(', ')}</span>}
            <StepScreenshot projectId={projectId} flowId={flow.id} step={s} onChanged={onChanged} onError={onError} />
            <button onClick={() => editStep(s)} className="text-gray-300 hover:text-blue-500 text-[10px]">edit</button>
            <button onClick={() => removeStep(s.stepId)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {steps.length === 0 && <p className="text-[11px] text-gray-400">No steps yet. Add the journey's first step below.</p>}
      </div>

      {/* step draft form */}
      <div className="bg-white border rounded-lg p-2.5 space-y-2">
        <p className="text-[11px] font-medium text-gray-600">{draft.stepId && steps.some((s) => s.stepId === draft.stepId) ? `Edit ${draft.stepId}` : 'Add step'}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Mini label="Step ID" value={draft.stepId} onChange={(v) => setDraft((d) => ({ ...d, stepId: v }))} placeholder="S01" />
          <MiniSelect label="Node" value={draft.nodeType} onChange={(v) => setDraft((d) => ({ ...d, nodeType: v as E2eNodeType }))} options={NODE_TYPES} />
          <MiniSelect label="Module" value={draft.moduleDbId} onChange={(v) => setDraft((d) => ({ ...d, moduleDbId: v }))}
            options={['', ...modules.map((m) => m.moduleDbId)]} render={(v) => v ? moduleName(v) : '—'} />
          <MiniSelect label="Layer" value={draft.layer} onChange={(v) => setDraft((d) => ({ ...d, layer: v }))} options={['', ...LAYERS]} />
          <Mini label="Role" value={draft.role} onChange={(v) => setDraft((d) => ({ ...d, role: v }))} placeholder="Customer" />
          <Mini label="Trigger" value={draft.triggerLabel} onChange={(v) => setDraft((d) => ({ ...d, triggerLabel: v }))} placeholder="Enter OTP" />
          <Mini label="Outcome" value={draft.outcome} onChange={(v) => setDraft((d) => ({ ...d, outcome: v }))} placeholder="Authorized" />
        </div>
        <Mini label="Condition" value={draft.condition} onChange={(v) => setDraft((d) => ({ ...d, condition: v }))} placeholder="if OTP valid" />

        {/* Screen — pick an analyzed screen OR attach a custom screenshot (both optional) */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Screen — pick an analyzed screen or attach a custom screenshot (both optional)</p>
          <div className="flex items-start gap-4 flex-wrap">
            <ScreenPicker projectId={projectId} moduleDbId={draft.moduleDbId} value={draft.screenId}
              onChange={(v) => setDraft((d) => ({ ...d, screenId: v }))} />
            <ScreenshotAttach existing={editingStep?.screenshotData ?? null} pending={pendingShot}
              onPick={setPendingShot} onClearPending={() => setPendingShot(null)} />
          </div>
        </div>

        {/* Integration (optional — special mention, like Screen) */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-56">
            <MiniSelect label="Integration (optional — e.g. payment)" value={draft.thirdPartyIntegrationId}
              onChange={(v) => setDraft((d) => ({ ...d, thirdPartyIntegrationId: v }))}
              options={['', ...integrations.map((i) => i.id)]}
              render={(v) => (v ? `${integrations.find((i) => i.id === v)?.vendorName ?? '?'}` : '— none —')} />
          </div>
          <AddIntegrationInline projectId={projectId}
            onAdded={async (id) => { await onIntegrationsChange(); setDraft((d) => ({ ...d, thirdPartyIntegrationId: id })); }}
            onError={onError} />
          {draft.thirdPartyIntegrationId && <span className="text-[10px] text-indigo-600 mb-1">↳ marks this step as an Integration</span>}
        </div>

        {/* edges (decision-graph) */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Branches → next steps</p>
          {draft.edges.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={e.nextStepId} onChange={(ev) => setEdge(i, 'nextStepId', ev.target.value)} placeholder="next stepId (S02)" className="text-xs border rounded px-2 py-1 w-32" />
              <input value={e.label} onChange={(ev) => setEdge(i, 'label', ev.target.value)} placeholder="branch label (OTP valid)" className="text-xs border rounded px-2 py-1 flex-1" />
              <button onClick={() => setDraft((d) => ({ ...d, edges: d.edges.filter((_, idx) => idx !== i) }))} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setDraft((d) => ({ ...d, edges: [...d.edges, { nextStepId: '', label: '' }] }))}>
            <Plus className="h-3 w-3 mr-1" /> branch
          </Button>
        </div>

        <div className="flex justify-end gap-1.5">
          {draft.stepId && <Button size="sm" variant="ghost" onClick={resetDraft}>Clear</Button>}
          <Button size="sm" onClick={save} disabled={saving || !draft.stepId.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" /> Save step</>}
          </Button>
        </div>
      </div>

      {/* downstream elaboration + gap matrix (R-P3) */}
      <ElaborationMatrix projectId={projectId} flowId={flow.id} onError={onError} />

      {/* 4 Mermaid diagrams (R-P5) */}
      <DiagramsPanel projectId={projectId} flow={flow} onChanged={onChanged} onError={onError} />

      {/* E2E test plan + execution (R-P6) */}
      <TestPlanPanel projectId={projectId} flowId={flow.id} onError={onError} />
    </div>
  );
}

// ─── E2E test plan + execution (R-P6) ────────────────────────────────────────

function TestPlanPanel({ projectId, flowId, onError }: { projectId: string; flowId: string; onError: (m: string) => void }) {
  const [plan, setPlan] = useState<E2eTestPlan | null>(null);
  const [results, setResults] = useState<E2eRunResult[]>([]);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    try { setPlan(await getE2eTestPlan(projectId, flowId)); } catch { /* best-effort */ }
  }, [projectId, flowId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async () => {
    setRunning(true);
    try { setResults(await runE2eTests(projectId, flowId)); await refresh(); }
    catch (err) { onError(errMsg(err, 'E2E run failed')); } finally { setRunning(false); }
  };

  return (
    <details open className="text-[11px]">
      <summary className="cursor-pointer text-gray-600 font-medium flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" /> E2E Tests
        {plan && <span className={`text-[10px] rounded px-1.5 py-0.5 ${plan.gapSteps ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{plan.coveredSteps}/{plan.steps.length} steps covered</span>}
        <Button size="sm" className="ml-auto h-6 text-[10px] px-1.5" onClick={(e) => { e.preventDefault(); void run(); }} disabled={running}>
          {running ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running…</> : <><PlayLike /> Run E2E tests</>}
        </Button>
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-gray-400">FTC coverage + layered assertions (UI/DB/white-box) per step, composed across modules. Run reuses the FTC Playwright runner per spanned module.</p>
        {plan && plan.steps.length > 0 ? (
          <table className="text-[10px] border-collapse">
            <thead><tr className="text-gray-400"><th className="text-left pr-2 font-normal">step</th><th className="text-left pr-2 font-normal">module</th><th className="px-1 font-normal">cases</th><th className="px-1 font-normal">UI</th><th className="px-1 font-normal">DB</th><th className="px-1 font-normal">WBox</th><th className="px-1 font-normal">cov</th></tr></thead>
            <tbody>
              {plan.steps.map((s) => (
                <tr key={s.stepId} className="border-t">
                  <td className="pr-2 font-mono text-gray-500">{s.stepId}</td>
                  <td className="pr-2 text-indigo-600">{s.moduleId ?? '—'}</td>
                  <td className="px-1 text-center">{s.totalCases}</td>
                  <td className="px-1 text-center">{s.uiCases}</td>
                  <td className="px-1 text-center">{s.dbCases}</td>
                  <td className="px-1 text-center">{s.whiteBoxCases}</td>
                  <td className="px-1 text-center">{s.covered ? <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" /> : <span className="text-amber-400" title="no FTC cases">·</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-gray-400">Add steps with modules to compose a test plan.</p>}
        {results.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Last run</p>
            {results.map((r) => (
              <div key={r.moduleDbId} className="flex items-center gap-2 text-[10px]">
                <span className="text-indigo-600">{r.moduleId}</span>
                <span className={`uppercase rounded px-1 py-0.5 ${r.run.status === 'PASSED' ? 'bg-emerald-100 text-emerald-700' : r.run.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.run.status}</span>
                <span className="text-gray-400">{r.run.passed}/{r.run.total || '—'} · {r.run.framework}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function PlayLike() {
  return <Workflow className="h-3 w-3 mr-1" />;
}

// ─── Mermaid diagrams (R-P5) ─────────────────────────────────────────────────

const DIAGRAM_LABELS: Record<string, string> = {
  functional: 'Functional flow', classMethod: 'Classes & methods', dbEntities: 'DB entities', integrations: '3rd-party integrations',
};

function DiagramsPanel({ projectId, flow, onChanged, onError }: { projectId: string; flow: E2eFlow; onChanged: () => void | Promise<void>; onError: (m: string) => void }) {
  const [building, setBuilding] = useState(false);
  const [active, setActive] = useState('functional');
  const diagrams = flow.mermaidDiagrams ?? {};
  const keys = ['functional', 'classMethod', 'dbEntities', 'integrations'].filter((k) => diagrams[k]);

  const build = async () => {
    setBuilding(true);
    try { await buildE2eDiagrams(projectId, flow.id); await onChanged(); }
    catch (err) { onError(errMsg(err, 'Diagram build failed')); } finally { setBuilding(false); }
  };

  return (
    <details open className="text-[11px]">
      <summary className="cursor-pointer text-gray-600 font-medium flex items-center gap-1.5">
        <Network className="h-3.5 w-3.5" /> Diagrams
        <Button size="sm" variant="outline" className="ml-auto h-6 text-[10px] px-1.5" onClick={(e) => { e.preventDefault(); void build(); }} disabled={building}>
          {building ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Build diagrams</>}
        </Button>
      </summary>
      <div className="mt-2 space-y-2">
        {keys.length === 0 ? (
          <p className="text-gray-400">No diagrams yet — click “Build diagrams” (derives them from the steps, branches & elaboration).</p>
        ) : (
          <>
            <div className="flex gap-1 flex-wrap">
              {keys.map((k) => (
                <button key={k} onClick={() => setActive(k)}
                  className={`text-[10px] rounded px-1.5 py-0.5 border ${active === k ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                  {DIAGRAM_LABELS[k] ?? k}
                </button>
              ))}
            </div>
            {diagrams[active] && <Mermaid content={diagrams[active]} />}
          </>
        )}
      </div>
    </details>
  );
}

function Mermaid({ content }: { content: string }) {
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const id = 'e2e-' + Math.random().toString(36).slice(2, 9);
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        const { svg } = await mermaid.render(id, content);
        if (!cancelled) { setSvg(svg); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Mermaid render failed');
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

  if (err) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-amber-600">diagram render failed — source below</p>
        <pre className="bg-gray-900 text-gray-300 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap">{content}</pre>
      </div>
    );
  }
  return <div className="bg-white border rounded p-2 overflow-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ─── Elaboration + gap matrix (R-P3) ────────────────────────────────────────────

function ElaborationMatrix({ projectId, flowId, onError }: { projectId: string; flowId: string; onError: (m: string) => void }) {
  const [gaps, setGaps] = useState<StepGap[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try { setGaps(await getE2eGaps(projectId, flowId)); setLoaded(true); } catch { /* best-effort */ }
  }, [projectId, flowId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (stage: E2eStage | 'ALL') => {
    setBusy(stage);
    try {
      if (stage === 'ALL') {
        for (const st of E2E_STAGES) { const r = await elaborateE2eStage(projectId, flowId, st); setGaps(r.gaps); }
      } else {
        const r = await elaborateE2eStage(projectId, flowId, stage); setGaps(r.gaps);
      }
    } catch (err) { onError(errMsg(err, 'Elaboration failed')); } finally { setBusy(null); }
  };

  const totalGaps = gaps.reduce((n, g) => n + E2E_STAGES.filter((s) => !g.filled[s]).length, 0);

  return (
    <details open className="text-[11px]">
      <summary className="cursor-pointer text-gray-600 font-medium flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" /> Downstream elaboration & gaps
        {loaded && <span className={`text-[10px] rounded px-1.5 py-0.5 ${totalGaps ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{totalGaps} gap{totalGaps === 1 ? '' : 's'}</span>}
      </summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {E2E_STAGES.map((st) => (
            <Button key={st} size="sm" variant="outline" className="h-6 text-[10px] px-1.5" disabled={!!busy} onClick={() => run(st)}>
              {busy === st ? <Loader2 className="h-3 w-3 animate-spin" /> : st}
            </Button>
          ))}
          <Button size="sm" className="h-6 text-[10px] px-1.5" disabled={!!busy} onClick={() => run('ALL')}>
            {busy === 'ALL' ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> all…</> : 'Elaborate all'}
          </Button>
        </div>
        {gaps.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="text-[10px] border-collapse">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left pr-2 font-normal">step</th>
                  <th className="text-left pr-2 font-normal">module</th>
                  {E2E_STAGES.map((s) => <th key={s} className="px-1 font-normal">{s.replace('USER_STORY', 'US')}</th>)}
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.stepId} className="border-t">
                    <td className="pr-2 font-mono text-gray-500">{g.stepId}</td>
                    <td className="pr-2 text-indigo-600">{g.moduleId ?? '—'}</td>
                    {E2E_STAGES.map((s) => (
                      <td key={s} className="px-1 text-center">
                        {g.filled[s]
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" />
                          : <span className="text-amber-400" title="gap">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400">No steps to elaborate yet (add steps with a module first).</p>
        )}
        <p className="text-gray-400">A <span className="text-amber-500">·</span> = that stage has no artifact for the step&apos;s module yet — a design gap to close.</p>
      </div>
    </details>
  );
}

function AddIntegrationInline({ projectId, onAdded, onError }: { projectId: string; onAdded: (id: string) => void | Promise<void>; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState('');
  const [cat, setCat] = useState('PAYMENT');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!vendor.trim()) return;
    setBusy(true);
    try { const r = await upsertIntegration(projectId, { vendorName: vendor.trim(), category: cat }); setVendor(''); setOpen(false); await onAdded(r.id); }
    catch (err) { onError(errMsg(err, 'Add integration failed')); } finally { setBusy(false); }
  };
  if (!open) return <button onClick={() => setOpen(true)} className="text-[10px] text-indigo-600 hover:underline mb-1">+ add integration</button>;
  return (
    <div className="flex items-center gap-1 mb-0.5">
      <input value={vendor} onChange={(e) => setVendor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} placeholder="Stripe" className="text-xs border rounded px-1.5 py-1 w-24" />
      <select value={cat} onChange={(e) => setCat(e.target.value)} className="text-xs border rounded px-1 py-1">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}</Button>
    </div>
  );
}

// ─── Screen picker (reuse analyzed module screens) ──────────────────────────────

function ScreenPicker({ projectId, moduleDbId, value, onChange }: {
  projectId: string; moduleDbId: string; value: string; onChange: (v: string) => void;
}) {
  const [screens, setScreens] = useState<ModuleScreenRef[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!moduleDbId) { setScreens([]); return; }
    listModuleScreens(projectId, moduleDbId).then((s) => { if (!cancelled) setScreens(s); }).catch(() => { if (!cancelled) setScreens([]); });
    return () => { cancelled = true; };
  }, [projectId, moduleDbId]);

  useEffect(() => {
    let cancelled = false;
    if (moduleDbId && value && screens.some((s) => s.screenId === value)) {
      setLoadingPreview(true);
      getModuleScreenImage(projectId, moduleDbId, value)
        .then((d) => { if (!cancelled) setPreview(d); })
        .catch(() => { if (!cancelled) setPreview(null); })
        .finally(() => { if (!cancelled) setLoadingPreview(false); });
    } else setPreview(null);
    return () => { cancelled = true; };
  }, [projectId, moduleDbId, value, screens]);

  return (
    <div className="space-y-1 w-60">
      <label className="text-[10px] text-gray-400 block">Screen (analyzed module screen)</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!moduleDbId}
        className="w-full text-xs border rounded px-1.5 py-1 disabled:bg-gray-100 disabled:text-gray-400">
        {!moduleDbId ? (
          <option value="">pick a Module above to list screens</option>
        ) : (
          <>
            <option value="">— none —</option>
            {value && !screens.some((s) => s.screenId === value) && <option value={value}>{value} (custom)</option>}
            {screens.map((s) => <option key={s.screenId} value={s.screenId}>{s.screenId}{s.screenTitle ? ` — ${s.screenTitle}` : ''}</option>)}
          </>
        )}
      </select>
      {moduleDbId && screens.length === 0 && <p className="text-[10px] text-gray-400">No analyzed screens — use Attach screenshot →</p>}
      {loadingPreview && <Loader2 className="h-3 w-3 animate-spin text-gray-300" />}
      {preview && <img src={preview} alt="screen preview" className="max-h-28 rounded border" />}
    </div>
  );
}

// ─── Custom screenshot attach (held in form, uploaded on Save) ────────────────────

function ScreenshotAttach({ existing, pending, onPick, onClearPending }: {
  existing: string | null; pending: File | null; onPick: (f: File) => void; onClearPending: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) { setPendingUrl(null); return; }
    const url = URL.createObjectURL(pending);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const shown = pendingUrl ?? existing;
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-400 block">Custom screenshot</label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (inputRef.current) inputRef.current.value = ''; if (f) onPick(f); }} />
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => inputRef.current?.click()}>
          <ImageIcon className="h-3 w-3 mr-1" /> {shown ? 'Replace' : 'Attach screenshot'}
        </Button>
        {pending && <button onClick={onClearPending} className="text-[10px] text-gray-400 hover:text-red-500">clear</button>}
      </div>
      {shown && <img src={shown} alt="step screenshot" className="max-h-28 rounded border" />}
      {pending && <p className="text-[10px] text-amber-600">uploads on Save</p>}
    </div>
  );
}

// ─── Per-step custom screenshot (upload / view / remove) ─────────────────────────

function StepScreenshot({ projectId, flowId, step, onChanged, onError }: {
  projectId: string; flowId: string; step: E2eFlowStep; onChanged: () => void | Promise<void>; onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setBusy(true);
    try { await uploadStepScreenshot(projectId, flowId, step.stepId, file); await onChanged(); }
    catch (err) { onError(errMsg(err, 'Screenshot upload failed')); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await clearStepScreenshot(projectId, flowId, step.stepId); await onChanged(); }
    catch (err) { onError(errMsg(err, 'Remove failed')); } finally { setBusy(false); }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {step.screenshotData ? (
        <span className="inline-flex items-center gap-0.5">
          <button onClick={() => setZoom(true)} title="View screenshot"><img src={step.screenshotData} alt="" className="h-5 w-5 object-cover rounded border" /></button>
          <button onClick={remove} disabled={busy} className="text-gray-300 hover:text-red-500" title="Remove screenshot">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}</button>
        </span>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="text-gray-300 hover:text-indigo-500" title="Add screenshot">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
        </button>
      )}
      {zoom && step.screenshotData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-8" onClick={() => setZoom(false)}>
          <img src={step.screenshotData} alt="screenshot" className="max-h-full max-w-full rounded shadow-lg" />
        </div>
      )}
    </>
  );
}

// ─── tiny inputs ───────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-xs text-gray-500 block">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full text-sm border rounded px-2 py-1.5" />
    </label>
  );
}
function Mini({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-[10px] text-gray-400 block">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-0.5 w-full text-xs border rounded px-1.5 py-1" />
    </label>
  );
}
function MiniSelect({ label, value, onChange, options, render }: { label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string }) {
  return (
    <label className="text-[10px] text-gray-400 block">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 w-full text-xs border rounded px-1 py-1">
        {options.map((o) => <option key={o} value={o}>{render ? render(o) : (o || '—')}</option>)}
      </select>
    </label>
  );
}
