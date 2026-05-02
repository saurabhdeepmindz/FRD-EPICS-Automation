'use client';

import { useEffect, useMemo, useState } from 'react';
import { type BaArtifact } from '@/lib/ba-api';
import { parseFrdContent, type ParsedFeature, type ParsedFrdModule } from '@/lib/frd-parser';
import { ChevronDown, ChevronUp, AlertTriangle, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AiEditableSection } from './AiEditableSection';
import { ScreensGallery, extractScreenIds } from './ScreensGallery';

// Sections from the FRD skill that describe the *process* of producing the FRD
// rather than the FRD deliverable itself. These get grouped under
// "Internal FRD Processing" (collapsed by default), mirroring EPIC view.
const INTERNAL_SECTION_REGEX = /^(step\s*\d+|introduction|output\s*checklist|update\s*compact\s*module\s*index|validate\s*the\s*frd|obtain\s*customer\s*sign[\s-]?off|customer\s*sign[\s-]?off|sign[\s-]?off|definition\s*of\s*done)/i;

function isInternalSection(label: string): boolean {
  return INTERNAL_SECTION_REGEX.test(label.trim());
}

interface FrdArtifactViewProps {
  artifact: BaArtifact;
  activeFeatureId?: string | null;
  onUpdated?: () => void;
}

export function FrdArtifactView({ artifact, activeFeatureId, onUpdated }: FrdArtifactViewProps) {
  const parsed = useMemo<ParsedFrdModule>(() =>
    parseFrdContent(artifact.sections), [artifact.sections],
  );

  const { deliverableSections, internalSections } = useMemo(() => {
    const deliverable: typeof parsed.otherSections = [];
    const internal: typeof parsed.otherSections = [];
    for (const s of parsed.otherSections) {
      // Skip sections whose body is empty/whitespace-only — they show as
      // empty "click to expand" headers in the UI and add nothing for the
      // reader. Common case: SKILL-01-S emits a top-level FRD title H1
      // ("# Functional Requirements Document (FRD) — MOD-NN ...") with no
      // body text before the next H2; the section parser still creates a
      // section keyed off the heading, but len === 0.
      if (!s.content?.trim()) continue;
      (isInternalSection(s.label) ? internal : deliverable).push(s);
    }
    return { deliverableSections: deliverable, internalSections: internal };
  }, [parsed.otherSections]);

  const [internalExpanded, setInternalExpanded] = useState(false);

  // Auto-scroll to active feature when selected from tree
  useEffect(() => {
    if (activeFeatureId) {
      const el = document.getElementById(`feature-${activeFeatureId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeFeatureId]);

  return (
    <div className="space-y-6" data-testid="frd-artifact-view">
      {/* Module header */}
      {(parsed.moduleId || parsed.moduleName) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            {parsed.moduleId && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {parsed.moduleId}
              </span>
            )}
            <h2 className="text-base font-semibold text-foreground">{parsed.moduleName || artifact.artifactId}</h2>
            {parsed.packageName && (
              <span className="text-xs text-muted-foreground font-mono">({parsed.packageName})</span>
            )}
          </div>
          {parsed.moduleDescription && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{parsed.moduleDescription}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>{parsed.features.length} feature{parsed.features.length !== 1 ? 's' : ''}</span>
            {parsed.features.filter((f) => f.status.includes('PARTIAL')).length > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {parsed.features.filter((f) => f.status.includes('PARTIAL')).length} TBD-Future
              </span>
            )}
          </div>
        </div>
      )}

      {/* Feature cards */}
      {parsed.features.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Features</h3>
          {parsed.features.map((feature) => (
            <FeatureCard
              key={feature.featureId}
              feature={feature}
              isActive={activeFeatureId === feature.featureId}
              screens={artifact.module?.screens}
            />
          ))}
        </div>
      )}

      {/* Business Rules */}
      {parsed.businessRules && (
        <CollapsibleSection title="Business Rules" content={parsed.businessRules} artifact={artifact} onUpdated={onUpdated} />
      )}

      {/* Validations */}
      {parsed.validations && (
        <CollapsibleSection title="Validations" content={parsed.validations} artifact={artifact} onUpdated={onUpdated} />
      )}

      {/* TBD-Future Registry */}
      {parsed.tbdFutureRegistry && (
        <CollapsibleSection title="TBD-Future Integration Registry" content={parsed.tbdFutureRegistry} badgeColor="amber" artifact={artifact} onUpdated={onUpdated} />
      )}

      {/* Other deliverable sections */}
      {deliverableSections.map((section, idx) => (
        <CollapsibleSection key={idx} title={section.label} content={section.content} artifact={artifact} onUpdated={onUpdated} />
      ))}

      {/* ═══ FRD Internal Processing ═══ */}
      {internalSections.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
          <button
            onClick={() => setInternalExpanded((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Cog className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">FRD Internal Processing</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {internalSections.length} steps
              </span>
            </div>
            {internalExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {internalExpanded && (
            <div className="border-t border-border/50 p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground italic mb-2">
                These are the skill&apos;s internal processing steps and validations, not part of the FRD deliverable itself.
              </p>
              {internalSections.map((s, idx) => (
                <CollapsibleSection key={idx} title={s.label} content={s.content} defaultCollapsed artifact={artifact} onUpdated={onUpdated} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback if no features parsed */}
      {parsed.features.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No individual features could be parsed from the FRD output.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            View the raw output using the skill overview in the tree.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Feature Card (matches PRD Generator style) ──────────────────────────────

function FeatureCard({ feature, isActive, screens }: { feature: ParsedFeature; isActive: boolean; screens?: import('@/lib/ba-api').BaScreenLite[] }) {
  const [expanded, setExpanded] = useState(isActive);

  // Resolve SCR-XX refs in this feature's Screen Reference to actual module screens
  const referencedScreens = (() => {
    if (!screens || screens.length === 0 || !feature.screenRef) return [];
    const ids = extractScreenIds(feature.screenRef);
    if (ids.length === 0) return [];
    return screens.filter((s) => ids.includes(s.screenId));
  })();

  const priorityColor = feature.priority.toLowerCase().includes('must')
    ? 'bg-red-100 text-red-700'
    : feature.priority.toLowerCase().includes('should')
      ? 'bg-amber-100 text-amber-700'
      : feature.priority.toLowerCase().includes('could')
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-600';

  const statusColor = feature.status.includes('PARTIAL')
    ? 'bg-amber-100 text-amber-700'
    : feature.status === 'CONFIRMED'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <div
      id={`feature-${feature.featureId}`}
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
      data-testid={`feature-card-${feature.featureId}`}
    >
      {/* Feature header — always visible */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
          {feature.featureId}
        </span>
        <span className="text-sm font-semibold text-foreground truncate flex-1">
          {feature.featureName}
        </span>
        {feature.priority && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0', priorityColor)}>
            {feature.priority}
          </span>
        )}
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0', statusColor)}>
          {feature.status.replace('CONFIRMED-', '').replace('CONFIRMED', 'OK')}
        </span>
      </button>

      {/* Expanded feature details — matches PRD Generator feature card layout.
          All 9 attributes always render so users can see the full FRD shape;
          when an attribute genuinely has no value the field shows "Not Applicable"
          instead of being silently hidden. */}
      {expanded && (
        <div className="border-t border-border">
          {/* Description */}
          <FeatureField label="Description" value={feature.description || 'Not Applicable'} />

          {/* Screen Reference — show SCR-XX text plus actual screen thumbnails */}
          <div className="px-4 py-2.5 border-t border-border/50">
            <span className="text-xs font-semibold text-muted-foreground">Screen Reference</span>
            <div className="mt-1 text-sm text-foreground">
              <MarkdownRenderer content={feature.screenRef || 'Not Applicable'} />
            </div>
            {referencedScreens.length > 0 && (
              <div className="mt-3">
                <ScreensGallery screens={referencedScreens} compact />
              </div>
            )}
          </div>

          {/* Trigger */}
          <FeatureField label="Trigger" value={feature.trigger || 'Not Applicable'} />

          {/* Pre-conditions */}
          <FeatureField label="Pre-conditions" value={feature.preConditions || 'Not Applicable'} />

          {/* Post-conditions */}
          <FeatureField label="Post-conditions" value={feature.postConditions || 'Not Applicable'} />

          {/* Business Rules */}
          <FeatureField label="Business Rules" value={feature.businessRules || 'Not Applicable'} />

          {/* Validations */}
          <FeatureField label="Validations" value={feature.validations || 'Not Applicable'} />

          {/* Integration Signals — preserves TBD-Future amber highlighting */}
          <div className="px-4 py-2.5 border-t border-border/50">
            <span className="text-xs font-semibold text-muted-foreground">Integration Signals</span>
            <div className={cn(
              'mt-1 text-sm',
              (feature.integrationSignals || '').includes('TBD-Future') ? 'text-amber-700 bg-amber-50 rounded px-2 py-1' : 'text-foreground',
            )}>
              <MarkdownRenderer content={feature.integrationSignals || 'Not Applicable'} />
            </div>
          </div>

          {/* Acceptance Criteria */}
          <FeatureField label="Acceptance Criteria" value={feature.acceptanceCriteria || 'Not Applicable'} />
        </div>
      )}
    </div>
  );
}

function FeatureField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 border-t border-border/50">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="mt-1 text-sm text-foreground">
        <MarkdownRenderer content={value} />
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title, content, badgeColor, defaultCollapsed = false, artifact, onUpdated,
}: {
  title: string;
  content: string;
  badgeColor?: string;
  defaultCollapsed?: boolean;
  artifact?: BaArtifact;
  onUpdated?: () => void;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  const findSection = (sections: BaArtifact['sections']) => sections.find(
    (s) => s.sectionLabel.toLowerCase() === title.toLowerCase()
      || s.sectionKey.toLowerCase() === title.toLowerCase().replace(/\s+/g, '_'),
  );
  const matched = artifact ? findSection(artifact.sections) : undefined;
  const isAi = Boolean(matched?.aiGenerated && !matched?.isHumanModified);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badgeColor === 'amber' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {artifact ? (
            <AiEditableSection
              artifact={artifact}
              label={title}
              content={content}
              findSection={findSection}
              isAi={isAi}
              onUpdated={onUpdated}
            />
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>
      )}
    </div>
  );
}
