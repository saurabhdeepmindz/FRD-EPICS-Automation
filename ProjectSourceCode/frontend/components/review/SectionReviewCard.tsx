'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Edit3, X, AlertTriangle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTION_FIELDS } from '@/lib/section-fields';

export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'skipped';

/** Check if a string value is AI-generated (has [AI] prefix) */
function isAiValue(val: string): boolean {
  return val.trimStart().startsWith('[AI]');
}

/** Strip [AI] prefix for display, return { text, isAi } */
function parseValue(val: string): { text: string; isAi: boolean } {
  const trimmed = val.trimStart();
  if (trimmed.startsWith('[AI] ')) return { text: trimmed.slice(5), isAi: true };
  if (trimmed.startsWith('[AI]')) return { text: trimmed.slice(4).trimStart(), isAi: true };
  return { text: val, isAi: false };
}

interface FeatureObj {
  featureId: string;
  featureName: string;
  description: string;
  businessRule: string;
  acceptanceCriteria: string;
  priority: string;
}

interface ModuleData {
  key: string;
  name: string;
  description: string;
  businessRules: string;
  features: FeatureObj[];
}

const NFR_NAMES: Record<string, string> = {
  '10.1': 'Performance',
  '10.2': 'Security',
  '10.3': 'Scalability',
  '10.4': 'Availability',
  '10.5': 'Privacy',
  '10.6': 'Maintainability',
  '10.7': 'Audit & Logging',
};

/** Extract modules from Section 6 content */
function extractModules(content: Record<string, unknown>): ModuleData[] {
  const moduleKeys = new Set<string>();
  for (const k of Object.keys(content)) {
    const m = k.match(/^(\d+\.\d+)_/);
    if (m) moduleKeys.add(m[1]);
  }
  return [...moduleKeys].sort().map((key) => ({
    key,
    name: String(content[`${key}_moduleName`] ?? key),
    description: String(content[`${key}_moduleDescription`] ?? ''),
    businessRules: String(content[`${key}_moduleBusinessRules`] ?? ''),
    features: Array.isArray(content[`${key}_features`])
      ? (content[`${key}_features`] as FeatureObj[])
      : [],
  }));
}

/** Extract NFR sub-modules from Section 10 content */
function extractNFRs(content: Record<string, unknown>): { key: string; name: string; requirement: string; metric: string; priority: string }[] {
  const nfrKeys = new Set<string>();
  for (const k of Object.keys(content)) {
    const m = k.match(/^(10\.\d+)_/);
    if (m) nfrKeys.add(m[1]);
  }
  return [...nfrKeys].sort().map((key) => ({
    key,
    name: NFR_NAMES[key] ?? String(content[`${key}_category`] ?? key),
    requirement: String(content[`${key}_requirement`] ?? ''),
    metric: String(content[`${key}_metric`] ?? ''),
    priority: String(content[`${key}_priority`] ?? ''),
  }));
}

interface SectionReviewCardProps {
  sectionNumber: number;
  sectionName: string;
  content: Record<string, unknown>;
  status: ReviewStatus;
  onAccept: () => void;
  onEdit: (content: Record<string, unknown>) => void;
  onSkip: () => void;
}

export function SectionReviewCard({
  sectionNumber,
  sectionName,
  content,
  status,
  onAccept,
  onEdit,
  onSkip,
}: SectionReviewCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [expanded, setExpanded] = useState(false);
  const fields = SECTION_FIELDS[sectionNumber] ?? [];

  const hasContent = Object.entries(content).some(([, v]) => {
    if (typeof v === 'string') return v.trim() !== '' && v !== 'TBD';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
    return false;
  });

  // Count AI-generated fields (including nested feature strings)
  let aiFieldCount = 0;
  for (const v of Object.values(content)) {
    if (typeof v === 'string' && isAiValue(v)) aiFieldCount++;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'object' && item !== null) {
          for (const fv of Object.values(item as Record<string, string>)) {
            if (typeof fv === 'string' && isAiValue(fv)) aiFieldCount++;
          }
        }
      }
    }
  }

  const statusColors: Record<ReviewStatus, string> = {
    pending: 'border-border',
    accepted: 'border-green-300 bg-green-50/50',
    edited: 'border-blue-300 bg-blue-50/50',
    skipped: 'border-muted bg-muted/30 opacity-60',
  };

  function handleSaveEdit() {
    onEdit(editContent);
    setEditing(false);
  }

  // Section 6: modules + features
  const isSection6 = sectionNumber === 6 && Object.keys(content).some((k) => k.match(/^\d+\.\d+_moduleName$/));
  const modules = isSection6 ? extractModules(content) : [];
  const totalFeatures = modules.reduce((sum, m) => sum + m.features.length, 0);

  // Section 10: NFR sub-modules
  const isSection10 = sectionNumber === 10 && Object.keys(content).some((k) => k.match(/^10\.\d+_/));
  const nfrs = isSection10 ? extractNFRs(content) : [];

  return (
    <div
      className={cn('rounded-lg border p-4 transition-all', statusColors[status])}
      data-testid={`review-card-${sectionNumber}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              Section {sectionNumber} — {sectionName}
            </h3>
            {(isSection6 || isSection10) && hasContent && (
              <button
                onClick={() => setExpanded((p) => !p)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={expanded ? 'Collapse' : 'Expand details'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {!hasContent && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                GAP — not found in source
              </span>
            )}
            {aiFieldCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <Sparkles className="h-3 w-3" />
                {aiFieldCount} AI-generated field{aiFieldCount > 1 ? 's' : ''}
              </span>
            )}
            {isSection6 && modules.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {modules.length} modules &middot; {totalFeatures} features
              </span>
            )}
            {isSection10 && nfrs.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {nfrs.length} NFR categories
              </span>
            )}
          </div>
        </div>
        {status !== 'pending' && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
            status === 'accepted' && 'bg-green-100 text-green-700',
            status === 'edited' && 'bg-blue-100 text-blue-700',
            status === 'skipped' && 'bg-muted text-muted-foreground',
          )}>
            {status}
          </span>
        )}
      </div>

      {/* Content display */}
      {editing ? (
        <div className="space-y-3 mb-3">
          {fields.map((field) => {
            const rawVal = editContent[field.key];
            const strVal = typeof rawVal === 'string' ? rawVal : '';
            return (
              <div key={field.key}>
                <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                {field.multiline ? (
                  <textarea
                    value={strVal}
                    onChange={(e) => setEditContent({ ...editContent, [field.key]: e.target.value })}
                    rows={3}
                    className="w-full rounded border border-input px-2 py-1.5 text-sm mt-1 bg-background"
                  />
                ) : (
                  <input
                    type="text"
                    value={strVal}
                    onChange={(e) => setEditContent({ ...editContent, [field.key]: e.target.value })}
                    className="w-full rounded border border-input px-2 py-1.5 text-sm mt-1 bg-background"
                  />
                )}
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mb-3">

          {/* ═══ Section 6: Modules + Features ═══ */}
          {isSection6 && modules.length > 0 && (
            <div className="space-y-3">
              {modules.map((mod) => (
                <div key={mod.key} className="rounded-md border border-border bg-card/50 overflow-hidden">
                  {/* Module header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                    <span className="font-mono text-xs text-muted-foreground">{mod.key}</span>
                    <span className="text-sm font-semibold">{mod.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{mod.features.length} features</span>
                  </div>

                  {/* Module description (always visible) */}
                  {mod.description && (
                    <div className="px-3 py-2 border-b border-border/50">
                      <RichText label="Description" value={mod.description} />
                    </div>
                  )}

                  {/* Features (expanded) */}
                  {expanded && mod.features.length > 0 && (
                    <div className="divide-y divide-border/50">
                      {mod.features.map((feat) => (
                        <div key={feat.featureId} className="px-3 py-2.5 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {feat.featureId}
                            </span>
                            <span className="text-sm font-medium">{feat.featureName}</span>
                            {feat.priority && (
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto',
                                feat.priority.startsWith('P0') ? 'bg-red-100 text-red-700' :
                                feat.priority.startsWith('P1') ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600',
                              )}>
                                {feat.priority}
                              </span>
                            )}
                          </div>
                          {feat.description && <RichText label="Description" value={feat.description} />}
                          {feat.businessRule && <RichText label="Business Rule" value={feat.businessRule} />}
                          {feat.acceptanceCriteria && <RichText label="Acceptance Criteria" value={feat.acceptanceCriteria} />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Collapsed feature list */}
                  {!expanded && mod.features.length > 0 && (
                    <div className="px-3 py-2 flex flex-wrap gap-1.5">
                      {mod.features.map((feat) => (
                        <span key={feat.featureId} className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {feat.featureId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {!expanded && modules.length > 0 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Show all feature details...
                </button>
              )}
            </div>
          )}

          {/* ═══ Section 10: NFR Sub-modules ═══ */}
          {isSection10 && nfrs.length > 0 && (
            <div className="space-y-2">
              {nfrs.map((nfr) => (
                <div key={nfr.key} className="rounded-md border border-border bg-card/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{nfr.key}</span>
                    <span className="text-sm font-semibold">{nfr.name}</span>
                    {nfr.priority && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground ml-auto">
                        {nfr.priority}
                      </span>
                    )}
                  </div>
                  {nfr.requirement && <RichText label="Requirement" value={nfr.requirement} />}
                  {nfr.metric && <RichText label="Metric / SLA" value={nfr.metric} />}
                </div>
              ))}
            </div>
          )}

          {/* ═══ Standard fields (non-6, non-10, or when no prefixed keys) ═══ */}
          {!isSection6 && !isSection10 && fields.map((field) => {
            const rawVal = content[field.key];
            if (!rawVal || (typeof rawVal === 'string' && rawVal.trim() === '')) return null;
            const strVal = String(rawVal);
            const { text, isAi } = parseValue(strVal);
            return (
              <div key={field.key}>
                <span className="text-xs text-muted-foreground">{field.label}: </span>
                <span className={cn('text-sm whitespace-pre-wrap', isAi && 'text-blue-600')}>{text}</span>
              </div>
            );
          })}

          {/* Fallback for content keys not in SECTION_FIELDS */}
          {!isSection6 && !isSection10 && fields.length === 0 && Object.entries(content).map(([key, val]) => {
            if (typeof val !== 'string' || val.trim() === '') return null;
            const label = key.replace(/^\d+\.\d+_/, '').replace(/([A-Z])/g, ' $1').trim();
            const { text, isAi } = parseValue(val);
            return (
              <div key={key}>
                <span className="text-xs text-muted-foreground">{label}: </span>
                <span className={cn('text-sm whitespace-pre-wrap', isAi && 'text-blue-600')}>{text}</span>
              </div>
            );
          })}

          {!hasContent && (
            <p className="text-sm text-muted-foreground italic">No content generated for this section.</p>
          )}
        </div>
      )}

      {/* Actions */}
      {status === 'pending' && !editing && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAccept} data-testid={`btn-accept-${sectionNumber}`}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid={`btn-edit-${sectionNumber}`}>
            <Edit3 className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onSkip} data-testid={`btn-skip-${sectionNumber}`}>
            <X className="h-3.5 w-3.5 mr-1" />
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}

/** Helper: renders a label + value with AI blue coloring */
function RichText({ label, value }: { label: string; value: string }) {
  const { text, isAi } = parseValue(value);
  return (
    <div className="text-xs">
      <span className="text-muted-foreground font-medium">{label}: </span>
      <span className={cn('whitespace-pre-wrap', isAi ? 'text-blue-600' : 'text-foreground')}>{text}</span>
    </div>
  );
}
