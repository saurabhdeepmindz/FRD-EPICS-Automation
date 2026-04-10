'use client';

import { useEffect, useMemo, useState } from 'react';
import { type BaArtifact } from '@/lib/ba-api';
import { parseFrdContent, type ParsedFeature, type ParsedFrdModule } from '@/lib/frd-parser';
import { ChevronDown, ChevronUp, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FrdArtifactViewProps {
  artifact: BaArtifact;
  activeFeatureId?: string | null;
}

export function FrdArtifactView({ artifact, activeFeatureId }: FrdArtifactViewProps) {
  const parsed = useMemo<ParsedFrdModule>(() =>
    parseFrdContent(artifact.sections), [artifact.sections],
  );

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
            />
          ))}
        </div>
      )}

      {/* Business Rules */}
      {parsed.businessRules && (
        <CollapsibleSection title="Business Rules" content={parsed.businessRules} />
      )}

      {/* Validations */}
      {parsed.validations && (
        <CollapsibleSection title="Validations" content={parsed.validations} />
      )}

      {/* TBD-Future Registry */}
      {parsed.tbdFutureRegistry && (
        <CollapsibleSection title="TBD-Future Integration Registry" content={parsed.tbdFutureRegistry} badgeColor="amber" />
      )}

      {/* Other sections */}
      {parsed.otherSections.map((section, idx) => (
        <CollapsibleSection key={idx} title={section.label} content={section.content} />
      ))}

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

function FeatureCard({ feature, isActive }: { feature: ParsedFeature; isActive: boolean }) {
  const [expanded, setExpanded] = useState(isActive);

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

      {/* Expanded feature details — matches PRD Generator feature card layout */}
      {expanded && (
        <div className="border-t border-border">
          {/* Description */}
          {feature.description && (
            <FeatureField label="Description" value={feature.description} />
          )}

          {/* Screen Reference */}
          {feature.screenRef && (
            <FeatureField label="Screen Reference" value={feature.screenRef} />
          )}

          {/* Trigger */}
          {feature.trigger && (
            <FeatureField label="Trigger" value={feature.trigger} />
          )}

          {/* Pre-conditions */}
          {feature.preConditions && (
            <FeatureField label="Pre-conditions" value={feature.preConditions} />
          )}

          {/* Post-conditions */}
          {feature.postConditions && (
            <FeatureField label="Post-conditions" value={feature.postConditions} />
          )}

          {/* Business Rules */}
          {feature.businessRules && (
            <FeatureField label="Business Rules" value={feature.businessRules} />
          )}

          {/* Validations */}
          {feature.validations && (
            <FeatureField label="Validations" value={feature.validations} />
          )}

          {/* Integration Signals */}
          {feature.integrationSignals && (
            <div className="px-4 py-2.5 border-t border-border/50">
              <span className="text-xs font-semibold text-muted-foreground">Integration Signals</span>
              <div className={cn(
                'mt-1 text-sm whitespace-pre-wrap',
                feature.integrationSignals.includes('TBD-Future') ? 'text-amber-700 bg-amber-50 rounded px-2 py-1' : 'text-foreground',
              )}>
                {feature.integrationSignals}
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          {feature.acceptanceCriteria && (
            <FeatureField label="Acceptance Criteria" value={feature.acceptanceCriteria} />
          )}
        </div>
      )}
    </div>
  );
}

function FeatureField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 border-t border-border/50">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({ title, content, badgeColor }: { title: string; content: string; badgeColor?: string }) {
  const [expanded, setExpanded] = useState(false);
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
          <pre className="text-sm whitespace-pre-wrap text-foreground font-sans leading-relaxed">{content}</pre>
        </div>
      )}
    </div>
  );
}
