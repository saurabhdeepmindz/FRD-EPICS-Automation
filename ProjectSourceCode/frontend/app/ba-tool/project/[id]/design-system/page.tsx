'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Palette,
  Loader2,
  Save,
  Upload,
  Trash2,
  Sparkles,
  Monitor,
  Smartphone,
  BookmarkPlus,
  Plus,
  FolderUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getDesignSystem,
  saveDesignSystem,
  uploadDesignLogo,
  getDesignPreview,
  listDesignPresets,
  getDesignPresetTokens,
  saveDesignPreset,
  importDesignReferences,
  type DesignTokens,
  type DesignLogo,
  type DesignPreset,
} from '@/lib/pipeline-api';

const FALLBACK: DesignTokens = {
  brand: { productName: '—', primary: '#0B1B2E', cta: '#F97316', ctaHover: '#FB923C', surface: '#FFFFFF' },
  neutral: { bgPage: '#ECEEF2', bgSoft: '#F8FAFC', textPrimary: '#1F2A3A', textMuted: '#64748B', textSubtle: '#94A3B8', border: '#E2E8F0', borderMedium: '#CBD5E1' },
  semantic: { success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6', teal: '#0D9488', purple: '#7C3AED' },
  modulePalette: { mode: 'auto', colors: {} },
  personaPalette: { employee: '#7C3AED', manager: '#0F766E', hrAdmin: '#D97706', finance: '#1D4ED8', admin: '#C2410C', visitor: '#475569' },
  typography: { uiFont: 'Inter', monoFont: 'JetBrains Mono', baseSize: 14, weightNormal: 400, weightBold: 700 },
  shape: { radiusCard: 12, radiusPill: 999, density: 'comfortable', elevation: 'soft' },
  platform: { mobileFrameWidth: 390, breakpointMobile: 480, breakpointTablet: 980, touchTarget: 44 },
};

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : 'Request failed')
  );
}

export default function DesignSystemPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [tokens, setTokens] = useState<DesignTokens | null>(null);
  const [logo, setLogo] = useState<DesignLogo | null>(null);
  const [presets, setPresets] = useState<DesignPreset[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'web' | 'mobile'>('web');
  const [preview, setPreview] = useState('');
  const [importing, setImporting] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const refFilesRef = useRef<HTMLInputElement>(null);
  const refFolderRef = useRef<HTMLInputElement>(null);

  // Enable folder selection on the hidden folder input (non-standard attribute).
  useEffect(() => {
    if (refFolderRef.current) {
      refFolderRef.current.setAttribute('webkitdirectory', '');
      refFolderRef.current.setAttribute('directory', '');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ds, pl] = await Promise.all([getDesignSystem(projectId), listDesignPresets(projectId)]);
      setPresets(pl);
      if (ds) {
        setTokens(ds.tokens);
        setLogo(ds.logo);
        setPresetId(ds.presetId);
      } else {
        const seed = pl.find((p) => p.name.startsWith('Deepmindz')) ?? pl[0];
        setTokens(seed?.tokens ?? FALLBACK);
        setPresetId(seed?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live preview — debounced, re-renders on any token / platform / logo change.
  useEffect(() => {
    if (!tokens) return;
    const handle = setTimeout(async () => {
      try {
        setPreview(await getDesignPreview(projectId, { ...tokens, brand: { ...tokens.brand } }, platform));
      } catch {
        /* preview is best-effort */
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [tokens, platform, projectId, logo]);

  if (loading || !tokens) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading design system…
      </div>
    );
  }

  // Immutable group updater.
  const set = <K extends keyof DesignTokens>(group: K, patch: Partial<DesignTokens[K]>) =>
    setTokens((t) => (t ? { ...t, [group]: { ...t[group], ...patch } } : t));

  const onApplyPreset = async (id: string) => {
    setError(null);
    try {
      const t = await getDesignPresetTokens(projectId, id);
      setTokens({ ...t, brand: { ...t.brand, productName: tokens.brand.productName } });
      setPresetId(id);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const onUploadLogo = async (file: File) => {
    setError(null);
    try {
      setLogo(await uploadDesignLogo(projectId, file));
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveDesignSystem(projectId, tokens, logo, presetId);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const onSaveAsPreset = async () => {
    const name = window.prompt('Preset name:');
    if (!name) return;
    const scope = window.confirm('Share across all projects? OK = GLOBAL, Cancel = this project only') ? 'GLOBAL' : 'PROJECT';
    try {
      await saveDesignPreset(projectId, name, tokens, scope);
      setPresets(await listDesignPresets(projectId));
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const onImportReferences = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((f) => /\.(html?|css|svg|png|jpe?g)$/i.test(f.name));
    if (!files.length) { setError('No supported reference files (HTML/CSS/SVG/PNG/JPG).'); return; }
    setImporting(true);
    setError(null);
    try {
      const res = await importDesignReferences(projectId, files);
      setPresets(await listDesignPresets(projectId));
      if (res.rejected.length) setError(`Imported ${res.created.length}; skipped: ${res.rejected.join('; ')}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/ba-tool/project/${projectId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Project</Button>
        </Link>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-gray-700" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Look &amp; Feel — Design System</h1>
            <p className="text-sm text-gray-500">Define the UX look, feel &amp; usability for this project&apos;s wireframes</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/ba-tool/project/${projectId}/wireframes`}>
            <Button variant="outline" size="sm">Wireframes →</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={onSaveAsPreset}>
            <BookmarkPlus className="h-4 w-4 mr-1" /> Save as preset
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_560px] gap-6">
        {/* LEFT — form */}
        <div className="space-y-5">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Template library */}
          <Group title="Template library" icon={<Sparkles className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onApplyPreset(p.id)}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition ${
                    presetId === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                  }`}
                  title={p.scope === 'GLOBAL' ? 'Shared preset' : 'Project preset'}
                >
                  <Swatches t={p.tokens} />
                  <span className="font-medium text-gray-800">{p.name}</span>
                  {!p.isSeed && p.scope === 'PROJECT' && (
                    <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">imported</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => refFilesRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload references
              </Button>
              <Button size="sm" variant="outline" onClick={() => refFolderRef.current?.click()} disabled={importing}>
                <FolderUp className="h-4 w-4 mr-1" /> Upload folder
              </Button>
              <input ref={refFilesRef} type="file" multiple accept=".html,.htm,.css,.svg,.png,.jpg,.jpeg" className="hidden"
                onChange={(e) => { void onImportReferences(e.target.files); e.target.value = ''; }} />
              <input ref={refFolderRef} type="file" multiple className="hidden"
                onChange={(e) => { void onImportReferences(e.target.files); e.target.value = ''; }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Pick a template to fill the parameters, then tweak below — preview updates live. Or <b>upload reference screens/templates</b> (HTML/CSS/SVG/PNG/JPG, multi-select or a folder) to derive a preset — colors are extracted, type/shape stay at defaults.
            </p>
          </Group>

          {/* Brand + logo */}
          <Group title="Brand" icon={<Palette className="h-4 w-4" />}>
            <label className="block mb-3">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Product name</span>
              <input
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                value={tokens.brand.productName === '—' ? '' : tokens.brand.productName}
                placeholder="e.g. Acme HR"
                onChange={(e) => set('brand', { productName: e.target.value || '—' })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Primary" value={tokens.brand.primary} onChange={(v) => set('brand', { primary: v })} />
              <ColorField label="Accent / CTA" value={tokens.brand.cta} onChange={(v) => set('brand', { cta: v })} />
              <ColorField label="CTA hover" value={tokens.brand.ctaHover} onChange={(v) => set('brand', { ctaHover: v })} />
              <ColorField label="Surface" value={tokens.brand.surface} onChange={(v) => set('brand', { surface: v })} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              {logo?.dataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.dataUri} alt="logo" className="h-12 w-12 rounded object-contain border bg-white" />
              ) : (
                <div className="h-12 w-12 rounded border bg-gray-100 flex items-center justify-center text-gray-400 text-xs">no logo</div>
              )}
              <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Upload logo
              </Button>
              {logo && (
                <Button size="sm" variant="ghost" onClick={() => setLogo(null)} title="Remove logo">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
              <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadLogo(f); e.target.value = ''; }} />
              <span className="text-xs text-gray-400">PNG / JPG / SVG</span>
            </div>
          </Group>

          {/* Neutrals */}
          <Group title="Neutrals">
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Page bg" value={tokens.neutral.bgPage} onChange={(v) => set('neutral', { bgPage: v })} />
              <ColorField label="Soft bg" value={tokens.neutral.bgSoft} onChange={(v) => set('neutral', { bgSoft: v })} />
              <ColorField label="Text primary" value={tokens.neutral.textPrimary} onChange={(v) => set('neutral', { textPrimary: v })} />
              <ColorField label="Text muted" value={tokens.neutral.textMuted} onChange={(v) => set('neutral', { textMuted: v })} />
              <ColorField label="Text subtle" value={tokens.neutral.textSubtle} onChange={(v) => set('neutral', { textSubtle: v })} />
              <ColorField label="Border" value={tokens.neutral.border} onChange={(v) => set('neutral', { border: v })} />
            </div>
          </Group>

          {/* Semantic */}
          <Group title="Semantic colors">
            <div className="grid grid-cols-3 gap-3">
              <ColorField label="Success" value={tokens.semantic.success} onChange={(v) => set('semantic', { success: v })} />
              <ColorField label="Warning" value={tokens.semantic.warning} onChange={(v) => set('semantic', { warning: v })} />
              <ColorField label="Danger" value={tokens.semantic.danger} onChange={(v) => set('semantic', { danger: v })} />
              <ColorField label="Info" value={tokens.semantic.info} onChange={(v) => set('semantic', { info: v })} />
              <ColorField label="Teal" value={tokens.semantic.teal} onChange={(v) => set('semantic', { teal: v })} />
              <ColorField label="Purple" value={tokens.semantic.purple} onChange={(v) => set('semantic', { purple: v })} />
            </div>
          </Group>

          {/* Personas */}
          <Group title="Persona colors">
            <div className="grid grid-cols-3 gap-3">
              <ColorField label="Employee" value={tokens.personaPalette.employee} onChange={(v) => set('personaPalette', { employee: v })} />
              <ColorField label="Manager" value={tokens.personaPalette.manager} onChange={(v) => set('personaPalette', { manager: v })} />
              <ColorField label="HR Admin" value={tokens.personaPalette.hrAdmin} onChange={(v) => set('personaPalette', { hrAdmin: v })} />
              <ColorField label="Finance" value={tokens.personaPalette.finance} onChange={(v) => set('personaPalette', { finance: v })} />
              <ColorField label="Admin" value={tokens.personaPalette.admin} onChange={(v) => set('personaPalette', { admin: v })} />
              <ColorField label="Visitor" value={tokens.personaPalette.visitor} onChange={(v) => set('personaPalette', { visitor: v })} />
            </div>
          </Group>

          {/* Typography */}
          <Group title="Typography">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="UI font" value={tokens.typography.uiFont} onChange={(v) => set('typography', { uiFont: v })} />
              <TextField label="Mono font" value={tokens.typography.monoFont} onChange={(v) => set('typography', { monoFont: v })} />
              <NumField label="Base size (px)" value={tokens.typography.baseSize} onChange={(v) => set('typography', { baseSize: v })} />
              <NumField label="Bold weight" value={tokens.typography.weightBold} onChange={(v) => set('typography', { weightBold: v })} />
            </div>
          </Group>

          {/* Shape & platform */}
          <Group title="Shape &amp; density">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Card radius (px)" value={tokens.shape.radiusCard} onChange={(v) => set('shape', { radiusCard: v })} />
              <NumField label="Pill radius (px)" value={tokens.shape.radiusPill} onChange={(v) => set('shape', { radiusPill: v })} />
              <SelectField label="Density" value={tokens.shape.density} options={['comfortable', 'compact']} onChange={(v) => set('shape', { density: v as DesignTokens['shape']['density'] })} />
              <SelectField label="Elevation" value={tokens.shape.elevation} options={['flat', 'soft', 'raised']} onChange={(v) => set('shape', { elevation: v as DesignTokens['shape']['elevation'] })} />
              <NumField label="Mobile frame (px)" value={tokens.platform.mobileFrameWidth} onChange={(v) => set('platform', { mobileFrameWidth: v })} />
              <NumField label="Touch target (px)" value={tokens.platform.touchTarget} onChange={(v) => set('platform', { touchTarget: v })} />
            </div>
          </Group>
        </div>

        {/* RIGHT — live preview */}
        <div className="lg:sticky lg:top-6 h-fit space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Live preview</span>
            <div className="ml-auto inline-flex rounded-lg border overflow-hidden">
              <button onClick={() => setPlatform('web')} className={`flex items-center gap-1 px-3 py-1.5 text-sm ${platform === 'web' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>
                <Monitor className="h-4 w-4" /> Web
              </button>
              <button onClick={() => setPlatform('mobile')} className={`flex items-center gap-1 px-3 py-1.5 text-sm ${platform === 'mobile' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>
                <Smartphone className="h-4 w-4" /> Mobile
              </button>
            </div>
          </div>
          <Card>
            <CardContent className="p-2 bg-gray-100">
              <iframe
                title="design-preview"
                sandbox=""
                srcDoc={preview || '<p style="font:13px system-ui;color:#999;padding:16px">Rendering…</p>'}
                className="w-full bg-white rounded"
                style={{ height: platform === 'mobile' ? 760 : 620 }}
              />
            </CardContent>
          </Card>
          <p className="text-xs text-gray-400">
            The preview uses the same token→CSS mapping as the generated lo-fi/hi-fi wireframes, so what you see is what gets produced.
          </p>
        </div>
      </div>
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3 text-gray-800">
          {icon}
          <h2 className="font-semibold text-sm" dangerouslySetInnerHTML={{ __html: title }} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 rounded border cursor-pointer p-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      </div>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 text-sm" />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1 w-full border rounded px-2 py-1.5 text-sm" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 text-sm bg-white">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Swatches({ t }: { t: DesignTokens }) {
  const colors = [t.brand.primary, t.brand.cta, t.semantic.success, t.semantic.purple];
  return (
    <span className="flex gap-0.5">
      {colors.map((c, i) => <span key={i} className="h-4 w-2.5 rounded-sm" style={{ background: c }} />)}
    </span>
  );
}
