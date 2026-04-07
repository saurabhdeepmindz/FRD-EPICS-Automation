'use client';

import { useParams } from 'next/navigation';
import { usePrd } from '@/hooks/usePrd';
import { SECTIONS } from '@/lib/section-config';
import { SECTION_FIELDS } from '@/lib/section-fields';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, Upload } from 'lucide-react';
import { ViewSource } from '@/components/forms/ViewSource';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getHistory, uploadLogo } from '@/lib/api';
import type { AuditLogEntry } from '@/lib/api';

/** Render text with [AI] prefix detection — blue for AI, black for extracted. PDF stays all black. */
function AiText({ value, className }: { value: string; className?: string }) {
  const trimmed = value.trimStart();
  const isAi = trimmed.startsWith('[AI] ') || trimmed.startsWith('[AI]');
  const text = isAi ? trimmed.replace(/^\[AI\]\s*/, '') : value;
  return (
    <span className={`${className ?? ''} ${isAi ? 'text-blue-600' : ''}`.trim()}>
      {text}
    </span>
  );
}

interface FeatureObj {
  featureId: string;
  featureName: string;
  description: string;
  businessRule: string;
  acceptanceCriteria: string;
  priority: string;
}

interface ModuleInfo {
  key: string;
  moduleId: string;
  moduleName: string;
  moduleDescription: string;
  moduleBusinessRules: string;
  features: FeatureObj[];
}

const SECTION_NAMES: Record<number, string> = {
  1: 'Overview / Objective', 2: 'High-Level Scope', 3: 'Out of Scope',
  4: 'Assumptions and Constraints', 5: 'Actors / User Types', 6: 'Functional Requirements',
  7: 'Integration Requirements', 8: 'Customer Journeys / Flows', 9: 'Functional Landscape',
  10: 'Non-Functional Requirements', 11: 'Technology', 12: 'DevOps and Observability',
  13: 'UI/UX Requirements', 14: 'Branding Requirements', 15: 'Compliance Requirements',
  16: 'Testing Requirements', 17: 'Key Deliverables', 18: 'Receivables',
  19: 'Environment', 20: 'High-Level Timelines', 21: 'Success Criteria',
  22: 'Miscellaneous Requirements',
};

function extractModules(content: Record<string, unknown>): ModuleInfo[] {
  const moduleKeys = new Set<string>();
  for (const k of Object.keys(content)) {
    const match = k.match(/^(\d+\.\d+)_/);
    if (match) moduleKeys.add(match[1]);
  }
  return [...moduleKeys]
    .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]))
    .map((key) => ({
      key,
      moduleId: String(content[`${key}_moduleId`] ?? ''),
      moduleName: String(content[`${key}_moduleName`] ?? key),
      moduleDescription: String(content[`${key}_moduleDescription`] ?? ''),
      moduleBusinessRules: String(content[`${key}_moduleBusinessRules`] ?? ''),
      features: Array.isArray(content[`${key}_features`])
        ? (content[`${key}_features`] as FeatureObj[])
        : [],
    }));
}

/** Group history by version for Document History page */
function buildDocumentHistory(
  history: AuditLogEntry[],
): { version: string; date: string; descriptions: string[] }[] {
  const map = new Map<string, { date: string; descriptions: string[] }>();
  for (const e of history) {
    const sName = e.sectionNumber === 0 ? 'PRD' : `Section ${e.sectionNumber} (${SECTION_NAMES[e.sectionNumber] ?? ''})`;
    const field = e.fieldKey.replace(/^\d+\.\d+_/, '').replace(/([A-Z])/g, ' $1').replace(/^_/, '').trim();
    const desc = `${e.changeType.replace('_', ' ')} — ${sName}: ${field}`;
    const existing = map.get(e.version);
    if (!existing) {
      map.set(e.version, { date: e.createdAt, descriptions: [desc] });
    } else {
      existing.descriptions.push(desc);
      if (new Date(e.createdAt) > new Date(existing.date)) existing.date = e.createdAt;
    }
  }
  return [...map.entries()]
    .sort((a, b) => {
      const [aMaj, aMin] = a[0].split('.').map(Number);
      const [bMaj, bMin] = b[0].split('.').map(Number);
      return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
    })
    .map(([version, info]) => ({ version, ...info }));
}

export default function PrdPreviewPage() {
  const params = useParams<{ id: string }>();
  const prdId = params.id;
  const { prd, loading, error, reload } = usePrd(prdId);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prdId) {
      getHistory(prdId).then(setHistory).catch(() => setHistory([]));
    }
  }, [prdId]);

  const handleDownload = useCallback(
    async (format: 'pdf' | 'docx') => {
      const setLoading = format === 'pdf' ? setDownloadingPdf : setDownloadingDocx;
      setLoading(true);
      try {
        const response = await api.get(`/prd/${prdId}/export/${format}`, {
          responseType: 'blob',
          timeout: 60_000,
        });
        const mimeType =
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${prd?.prdCode ?? 'PRD'}-${prd?.productName ?? 'document'}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        alert(`Failed to download ${format.toUpperCase()}. Make sure the backend is running.`);
      } finally {
        setLoading(false);
      }
    },
    [prdId, prd],
  );

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !prdId) return;
      setUploadingLogo(true);
      try {
        await uploadLogo(prdId, file);
        reload();
      } catch {
        alert('Failed to upload logo.');
      } finally {
        setUploadingLogo(false);
        if (logoInputRef.current) logoInputRef.current.value = '';
      }
    },
    [prdId, reload],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading preview...</span>
      </div>
    );
  }

  if (error || !prd) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? 'PRD not found'}</p>
        <Button asChild variant="outline">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  // Compute derived data
  const section6 = prd.sections.find((s) => s.sectionNumber === 6);
  const modules = section6 ? extractModules(section6.content as Record<string, unknown>) : [];

  const latestEntry = history.length > 0 ? history[0] : null;
  const revisionDate = latestEntry
    ? new Date(latestEntry.createdAt).toLocaleDateString()
    : new Date(prd.createdAt).toLocaleDateString();
  const revisionNumber = latestEntry ? latestEntry.version : prd.version;

  const docHistory = buildDocumentHistory(history);

  function isSectionIncomplete(sectionNumber: number): boolean {
    const sec = prd?.sections.find((s) => s.sectionNumber === sectionNumber);
    if (!sec) return true;
    if (sec.status === 'NOT_STARTED') return true;
    const content = sec.content as Record<string, unknown>;
    if (sectionNumber === 6) return modules.length === 0;
    const values = Object.entries(content).filter(
      ([k, v]) => !k.endsWith('_features') && typeof v !== 'object' && String(v ?? '').trim() !== '',
    );
    return values.length === 0;
  }

  const incompleteSections = new Set(
    SECTIONS.filter((s) => isSectionIncomplete(s.number)).map((s) => s.number),
  );
  const incompleteCount = incompleteSections.size;

  return (
    <div className="flex h-screen" data-testid="prd-preview">
      {/* ═══ LEFT TOC SIDEBAR ═══ */}
      <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Table of Contents
          </h3>
          {incompleteCount > 0 && (
            <p className="text-[11px] text-red-500 mt-1.5">
              {incompleteCount} section{incompleteCount > 1 ? 's' : ''} incomplete
            </p>
          )}
        </div>
        <nav className="py-2 text-[13px]">
          {/* Cover, Doc History, TOC links */}
          <a href="#cover-page" className="flex items-center gap-2 px-4 py-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors font-medium">
            Cover Page
          </a>
          <a href="#doc-history" className="flex items-center gap-2 px-4 py-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors font-medium">
            Document History
          </a>
          <div className="border-t border-border my-2 mx-4" />

          {SECTIONS.map((s) => {
            const sectionModules = s.number === 6 ? modules : [];
            const hasSubModules = s.subModules && s.subModules.length > 0;

            return (
              <div key={s.number}>
                <a
                  href={`#section-${s.number}`}
                  className={`flex items-center gap-2 px-4 py-1.5 hover:bg-muted transition-colors ${
                    incompleteSections.has(s.number)
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  <span className="font-medium">{s.number}.</span>
                  <span className="truncate">{s.shortName}</span>
                  {incompleteSections.has(s.number) && (
                    <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">
                      Incomplete
                    </span>
                  )}
                </a>

                {s.number === 6 && sectionModules.length > 0 && (
                  <div className="ml-6 border-l border-border/50">
                    {sectionModules.map((mod) => (
                      <div key={mod.key}>
                        <a
                          href={`#module-${mod.key}`}
                          className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <span>{mod.key}</span>
                          <span className="truncate">{mod.moduleName}</span>
                        </a>
                        {mod.features.length > 0 && (
                          <div className="ml-4 border-l border-border/30">
                            {mod.features.map((feat) => (
                              <a
                                key={feat.featureId}
                                href={`#feat-${feat.featureId}`}
                                className="flex items-start gap-1 pl-3 pr-2 py-0.5 text-[11px] text-muted-foreground/70 hover:text-primary transition-colors"
                                title={`${feat.featureId} — ${feat.featureName}`}
                              >
                                <span className="font-mono shrink-0">{feat.featureId}</span>
                                <span className="truncate">- {feat.featureName}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {s.number === 10 && hasSubModules && (
                  <div className="ml-6 border-l border-border/50">
                    {s.subModules!.map((sub) => (
                      <a
                        key={sub.key}
                        href={`#module-${sub.key}`}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <span>{sub.key}</span>
                        <span className="truncate">{sub.label}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 pt-3 border-t border-border mx-4">
            <a
              href="#appendix-revision-history"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Appendix — Revision History
              {history.length > 0 && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{history.length}</span>
              )}
            </a>
          </div>
        </nav>
      </aside>

      {/* ═══ MAIN PREVIEW ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/prd/${prdId}/edit`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Editor
              </Link>
            </Button>
            <h1 className="text-sm font-semibold">{prd.productName} — Preview</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Logo upload */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              data-testid="logo-upload-input"
            />
            <ViewSource prdId={prdId} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              title="Upload client logo for cover page"
            >
              {uploadingLogo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Logo
            </Button>
            <Button size="sm" onClick={() => handleDownload('pdf')} disabled={downloadingPdf}>
              {downloadingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDownload('docx')} disabled={downloadingDocx}>
              {downloadingDocx ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              DOCX
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full">

            {/* ═══ PAGE 1: COVER PAGE ═══ */}
            <div id="cover-page" className="flex flex-col items-center justify-center min-h-[80vh] text-center px-8 py-16 border-b-2 border-border">
              {prd.clientLogo && (
                <img src={prd.clientLogo} alt="Client Logo" className="max-h-20 max-w-[200px] object-contain mb-10" />
              )}
              {!prd.clientLogo && (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="mb-10 border-2 border-dashed border-border rounded-lg px-8 py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  Click to upload Client Logo
                </button>
              )}
              <p className="text-sm uppercase tracking-[3px] text-muted-foreground font-semibold mb-4">
                Product Requirements Document
              </p>
              <h1 className="text-3xl font-bold text-foreground mb-6 leading-tight">
                PRD for {prd.productName}
              </h1>
              <div className="w-20 h-[3px] bg-primary rounded-full mb-8" />
              <table className="text-left mx-auto">
                <tbody>
                  <tr>
                    <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">PRD Code:</td>
                    <td className="py-1.5 text-sm text-foreground">{prd.prdCode}</td>
                  </tr>
                  {prd.clientName && (
                    <tr>
                      <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">Client Name:</td>
                      <td className="py-1.5 text-sm text-foreground">{prd.clientName}</td>
                    </tr>
                  )}
                  {prd.submittedBy && (
                    <tr>
                      <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">Submitted By:</td>
                      <td className="py-1.5 text-sm text-foreground">{prd.submittedBy}</td>
                    </tr>
                  )}
                  {prd.author && (
                    <tr>
                      <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">Author:</td>
                      <td className="py-1.5 text-sm text-foreground">{prd.author}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">Date:</td>
                    <td className="py-1.5 text-sm text-foreground">{revisionDate}</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">Revision:</td>
                    <td className="py-1.5 text-sm text-foreground">{revisionNumber}</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1.5 text-sm font-semibold text-muted-foreground text-right">Status:</td>
                    <td className="py-1.5 text-sm text-foreground">{prd.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ═══ PAGE 2: DOCUMENT HISTORY ═══ */}
            <div id="doc-history" className="px-8 py-10 border-b-2 border-border">
              <div className="text-center text-xs text-muted-foreground mb-6 pb-2 border-b border-border">
                Product Requirements Document
              </div>
              <h2 className="text-xl font-semibold mb-6 text-foreground border-b-2 border-border pb-2">
                Document History
              </h2>
              {docHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No changes recorded yet.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="px-3 py-2 border border-border font-semibold w-20">Version</th>
                      <th className="px-3 py-2 border border-border font-semibold w-28">Date</th>
                      <th className="px-3 py-2 border border-border font-semibold">Description of Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docHistory.map((row) => {
                      const descs = row.descriptions.slice(0, 5);
                      const more = row.descriptions.length > 5 ? ` (+${row.descriptions.length - 5} more)` : '';
                      return (
                        <tr key={row.version} className="hover:bg-muted/50">
                          <td className="px-3 py-2 border border-border font-mono">{row.version}</td>
                          <td className="px-3 py-2 border border-border whitespace-nowrap">
                            {new Date(row.date).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 border border-border text-xs">
                            <a href="#appendix-revision-history" className="text-blue-600 hover:underline">
                              {descs.join('; ')}{more}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ═══ PAGE 3: SECTIONS CONTENT ═══ */}
            <div className="px-8 py-6">
              {/* Header */}
              <div className="text-center text-xs text-muted-foreground mb-6 pb-2 border-b border-border">
                Product Requirements Document
              </div>

              {/* Sections */}
              {prd.sections.map((section) => {
                const content = (section.content ?? {}) as Record<string, unknown>;

                if (section.sectionNumber === 6) {
                  return (
                    <div key={6} id="section-6" className="mb-10">
                      <h2 className="text-xl font-semibold mb-4 text-foreground border-b border-border pb-2">
                        6. Functional Requirements
                      </h2>
                      {modules.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No modules added yet.</p>
                      ) : (
                        modules.map((mod) => (
                          <div key={mod.key} id={`module-${mod.key}`} className="mb-8 ml-2">
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              {mod.key} — {mod.moduleName}
                            </h3>
                            {mod.moduleId && (
                              <p className="text-xs text-muted-foreground mb-2">Module ID: {mod.moduleId}</p>
                            )}
                            {mod.moduleDescription && (
                              <div className="mb-3">
                                <h4 className="text-xs font-medium text-muted-foreground mb-1">Module Description</h4>
                                <p className="text-sm whitespace-pre-wrap"><AiText value={mod.moduleDescription} /></p>
                              </div>
                            )}
                            {mod.moduleBusinessRules && (
                              <div className="mb-3">
                                <h4 className="text-xs font-medium text-muted-foreground mb-1">Module Business Rules</h4>
                                <p className="text-sm whitespace-pre-wrap"><AiText value={mod.moduleBusinessRules} /></p>
                              </div>
                            )}
                            {mod.features.length > 0 && (
                              <div className="space-y-4 ml-2">
                                {mod.features.map((feat) => (
                                  <div
                                    key={feat.featureId}
                                    id={`feat-${feat.featureId}`}
                                    className="rounded-md border border-border p-4 bg-card"
                                  >
                                    <h4 className="text-sm font-semibold text-primary mb-2">
                                      {feat.featureId} — {feat.featureName}
                                    </h4>
                                    {feat.description && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-muted-foreground">Description: </span>
                                        <AiText value={feat.description} className="text-sm" />
                                      </div>
                                    )}
                                    {feat.businessRule && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-muted-foreground">Business Rule: </span>
                                        <AiText value={feat.businessRule} className="text-sm" />
                                      </div>
                                    )}
                                    {feat.acceptanceCriteria && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-muted-foreground">Acceptance Criteria: </span>
                                        <AiText value={feat.acceptanceCriteria} className="text-sm" />
                                      </div>
                                    )}
                                    {feat.priority && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Priority: </span>
                                        <span className="text-sm font-medium">{feat.priority}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  );
                }

                // Standard sections
                const fields = SECTION_FIELDS[section.sectionNumber] ?? [];
                const standardEntries = Object.entries(content).filter(
                  ([k, v]) => !k.endsWith('_features') && typeof v !== 'object' && String(v ?? '').trim() !== '',
                );
                const hasContent = standardEntries.length > 0;

                return (
                  <div key={section.sectionNumber} id={`section-${section.sectionNumber}`} className="mb-10">
                    <h2 className={`text-xl font-semibold mb-4 border-b pb-2 ${
                      incompleteSections.has(section.sectionNumber)
                        ? 'text-red-500 border-red-200'
                        : 'text-foreground border-border'
                    }`}>
                      {section.sectionNumber}. {section.sectionName}
                      {incompleteSections.has(section.sectionNumber) && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium align-middle">
                          Incomplete
                        </span>
                      )}
                    </h2>
                    {!hasContent ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm text-red-600 font-medium">Incomplete — This section has no content yet.</p>
                        <p className="text-xs text-red-400 mt-1">Please fill this section in the editor before finalising the PRD.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {fields.map((field) => {
                          const matchingEntries = Object.entries(content).filter(
                            ([k]) => k === field.key || k.endsWith(`_${field.key}`),
                          );
                          const values = matchingEntries
                            .map(([, v]) => String(v).trim())
                            .filter((v) => v !== '');
                          if (values.length === 0) return null;

                          return (
                            <div key={field.key}>
                              <h3 className="text-xs font-medium text-muted-foreground mb-1">{field.label}</h3>
                              {values.map((val, i) => (
                                <p key={i} className="text-sm whitespace-pre-wrap leading-relaxed"><AiText value={val} /></p>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ═══ APPENDIX: REVISION HISTORY ═══ */}
              <div id="appendix-revision-history" className="mb-10 mt-16">
                <h2 className="text-xl font-semibold mb-4 text-foreground border-b-2 border-foreground pb-2">
                  Appendix — Revision History
                </h2>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No changes recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted text-left">
                          <th className="px-3 py-2 border border-border font-semibold">Version</th>
                          <th className="px-3 py-2 border border-border font-semibold">Date</th>
                          <th className="px-3 py-2 border border-border font-semibold">Section</th>
                          <th className="px-3 py-2 border border-border font-semibold">Field</th>
                          <th className="px-3 py-2 border border-border font-semibold">Change Type</th>
                          <th className="px-3 py-2 border border-border font-semibold">Source</th>
                          <th className="px-3 py-2 border border-border font-semibold">Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((entry) => {
                          const sectionName = entry.sectionNumber === 0
                            ? 'PRD'
                            : `${entry.sectionNumber}. ${SECTIONS.find((s) => s.number === entry.sectionNumber)?.shortName ?? ''}`;
                          const fieldLabel = entry.fieldKey
                            .replace(/^\d+\.\d+_/, '')
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^_/, '')
                            .trim() || entry.fieldKey;
                          const summary = entry.previousValue
                            ? `"${(entry.previousValue).substring(0, 40)}..." → "${(entry.newValue ?? '').substring(0, 40)}..."`
                            : (entry.newValue ?? '').substring(0, 80);

                          return (
                            <tr key={entry.id} className="hover:bg-muted/50">
                              <td className="px-3 py-1.5 border border-border font-mono">{entry.version}</td>
                              <td className="px-3 py-1.5 border border-border whitespace-nowrap">
                                {new Date(entry.createdAt).toLocaleString()}
                              </td>
                              <td className="px-3 py-1.5 border border-border">{sectionName}</td>
                              <td className="px-3 py-1.5 border border-border font-mono">{fieldLabel}</td>
                              <td className="px-3 py-1.5 border border-border">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  entry.changeType === 'CREATED' ? 'bg-green-100 text-green-700' :
                                  entry.changeType === 'AI_GENERATED' ? 'bg-purple-100 text-purple-700' :
                                  entry.changeType === 'AI_MODIFIED' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {entry.changeType.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 border border-border">
                                <span className={`text-[10px] font-medium ${
                                  entry.source === 'AI' ? 'text-purple-600' : 'text-foreground'
                                }`}>
                                  {entry.source}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 border border-border text-muted-foreground max-w-[200px] truncate">
                                {summary}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground py-4 border-t border-border">
              Product Requirements Document — {prd.prdCode}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
