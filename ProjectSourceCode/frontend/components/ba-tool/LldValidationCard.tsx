'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import {
  validateLld,
  regenerateLldSection,
  type LldValidationReport,
  type LldSectionValidation,
} from '@/lib/ba-api';
import { pushToast } from '@/hooks/useToast';

interface Props {
  moduleDbId: string;
  /** Set when an LLD artifact exists for this module — only then does
   *  validation make sense. */
  hasLldArtifact: boolean;
}

/**
 * LLD completeness validator card. Calls the deterministic backend
 * validator (no AI cost) and surfaces per-section gaps with one-click
 * "Regenerate this section" buttons that fire focused single-section
 * AI calls (~$0.05 each, ~30-60 s).
 *
 * Always visible on the LLD Workbench page so the architect can spot-check
 * an existing artifact at any time, not just immediately after generation.
 */
export function LldValidationCard({ moduleDbId, hasLldArtifact }: Props) {
  const [report, setReport] = useState<LldValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runValidate = useCallback(async () => {
    if (!hasLldArtifact) {
      setError('No LLD artifact yet — click Generate LLD first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await validateLld(moduleDbId);
      setReport(r);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(`Validation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [moduleDbId, hasLldArtifact]);

  const regenSection = useCallback(
    async (sectionKey: string, sectionLabel: string) => {
      const ack = window.confirm(
        `Regenerate § ${sectionLabel}?\n\n` +
          `This makes ONE focused AI call (~30-60 s, ~$0.05) and rewrites only this section. ` +
          `Other sections + pseudo-files are untouched. Existing human edits to this section ` +
          `(if any) are preserved (the call short-circuits).\n\n` +
          `Click OK to proceed.`,
      );
      if (!ack) return;

      setRegeneratingKey(sectionKey);
      setError(null);
      try {
        const r = await regenerateLldSection(moduleDbId, sectionKey);
        if (r.skipped) {
          pushToast({
            title: `§ ${sectionLabel} skipped`,
            description: r.reason ?? 'Section was already populated and not eligible for regeneration.',
            variant: 'default',
          });
        } else if (r.sectionWritten) {
          pushToast({
            title: `§ ${sectionLabel} regenerated`,
            description: 'Section content updated. Re-running validator to refresh the report.',
            variant: 'success',
          });
        } else {
          pushToast({
            title: `§ ${sectionLabel} did not write`,
            description: 'AI returned but the parser could not extract this section. Check backend logs.',
            variant: 'destructive',
          });
        }
        // Re-validate so the report reflects the new state.
        await runValidate();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Regeneration of ${sectionLabel} failed: ${msg}`);
      } finally {
        setRegeneratingKey(null);
      }
    },
    [moduleDbId, runValidate],
  );

  return (
    <Card className="border-2">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              LLD Completeness Validator
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Deterministic check (no AI cost). Reports missing/thin sections + pseudo-file shortfall.
              Each gap has a per-section regenerate button that makes a focused AI call.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runValidate}
            disabled={loading || !hasLldArtifact}
            title={hasLldArtifact ? 'Run completeness check' : 'Generate an LLD first'}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            {report ? 'Re-validate' : 'Validate'}
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 flex items-start gap-2">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {report && <ReportBody report={report} regeneratingKey={regeneratingKey} onRegen={regenSection} />}

        {!report && !error && !loading && !hasLldArtifact && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Validate is disabled — no LLD artifact yet.</p>
              <p className="text-amber-800 mt-0.5">
                The validator runs against a generated LLD. Click <strong>Generate LLD</strong> at the top
                of the page to produce the first artifact (~3-5 min, single AI call). After it lands, the
                Validate button enables and you can spot-check section completeness.
              </p>
            </div>
          </div>
        )}

        {!report && !error && !loading && hasLldArtifact && (
          <p className="text-xs text-muted-foreground italic">
            Click <strong>Validate</strong> to run the completeness check.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportBody({
  report,
  regeneratingKey,
  onRegen,
}: {
  report: LldValidationReport;
  regeneratingKey: string | null;
  onRegen: (sectionKey: string, sectionLabel: string) => void;
}) {
  const missing = report.sections.filter((s) => !s.present);
  const sectionsBadge = report.sectionsPresent === report.sectionsExpected ? '✅' : '⚠️';
  const pseudoBadge =
    report.pseudoFilesCount >= report.pseudoFilesExpected ? '✅' : '⚠️';
  const featureBadge = report.featuresWithoutPseudoFiles.length === 0 ? '✅' : '⚠️';

  return (
    <div className="space-y-3">
      {/* Headline counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <div className="font-medium">
            {sectionsBadge} Sections
          </div>
          <div className="text-muted-foreground">
            {report.sectionsPresent} of {report.sectionsExpected} present
          </div>
        </div>
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <div className="font-medium">
            {pseudoBadge} Pseudo-files
          </div>
          <div className="text-muted-foreground">
            {report.pseudoFilesCount} present (target ≥ {report.pseudoFilesExpected})
          </div>
        </div>
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <div className="font-medium">
            {featureBadge} Feature coverage
          </div>
          <div className="text-muted-foreground">
            {report.featuresWithoutPseudoFiles.length === 0
              ? 'All features referenced'
              : `${report.featuresWithoutPseudoFiles.length} feature(s) missing`}
          </div>
        </div>
      </div>

      {/* Overall verdict */}
      {report.isComplete ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            <strong>LLD is complete.</strong> All 19 canonical sections are populated and pseudo-file
            coverage is sufficient.
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">{report.gaps.length} gap(s) detected.</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {report.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Per-section table when there are gaps */}
      {missing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">Sections needing attention:</p>
          <div className="rounded-md border divide-y">
            {missing.map((s) => (
              <SectionRow
                key={s.sectionKey}
                section={s}
                isRegenerating={regeneratingKey === s.sectionKey}
                disabled={regeneratingKey !== null && regeneratingKey !== s.sectionKey}
                onRegen={() => onRegen(s.sectionKey, s.sectionLabel)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Features without pseudo-file coverage — manual fix only */}
      {report.featuresWithoutPseudoFiles.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
          <p className="font-medium">Features without pseudo-file coverage:</p>
          <p className="text-muted-foreground">
            {report.featuresWithoutPseudoFiles.join(', ')}
          </p>
          <p className="text-muted-foreground italic">
            Per-section regeneration won't fix this — re-click <strong>Re-generate LLD</strong> at
            the top of the page (creates a new versioned artifact) or manually edit pseudo-files in
            the editor to reference these IDs.
          </p>
        </div>
      )}

      {/* Frontend coverage breakdown — only when frontend stack is selected */}
      {report.frontendCoverage && <FrontendCoveragePanel fc={report.frontendCoverage} />}
    </div>
  );
}

function FrontendCoveragePanel({ fc }: { fc: NonNullable<LldValidationReport['frontendCoverage']> }) {
  const row = (
    label: string,
    count: number,
    expected: number,
    hint: string,
  ): ReactNode => {
    const ok = count >= expected;
    return (
      <div className="flex items-center justify-between px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">{label}</div>
            <div className="text-muted-foreground">{hint}</div>
          </div>
        </div>
        <span className={ok ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
          {count} / {expected}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">
          Frontend coverage
          {fc.stackName ? <span className="text-muted-foreground font-normal"> — {fc.stackName}</span> : null}
        </p>
        <span
          className={
            fc.isComplete
              ? 'text-[11px] text-emerald-700 font-medium'
              : 'text-[11px] text-amber-700 font-medium'
          }
        >
          {fc.isComplete ? '✅ complete' : '⚠️ incomplete'}
        </span>
      </div>
      <div className="rounded-md border divide-y">
        {row(
          'App Router pages',
          fc.pagesCount,
          fc.pagesExpected,
          'frontend/app/<feature>/page.tsx (Next.js App Router)',
        )}
        {row(
          'Route handlers',
          fc.routeHandlersCount,
          fc.routeHandlersExpected,
          'frontend/app/api/<resource>/route.ts (server-side endpoints)',
        )}
        {row(
          'Components (.tsx)',
          fc.componentsCount,
          fc.componentsExpected,
          'frontend/components/<feature>/<Name>.tsx (UI primitives)',
        )}
        {row(
          'Frontend tests',
          fc.frontendTestsCount,
          fc.frontendTestsExpected,
          'tests/frontend/**/*.test.tsx (component-level tests)',
        )}
      </div>
      {fc.featuresWithoutPage.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
          <p className="font-medium">Features without an App Router page reference:</p>
          <p className="text-muted-foreground">{fc.featuresWithoutPage.join(', ')}</p>
          <p className="text-muted-foreground italic">
            The AI did not produce a `frontend/app/&lt;feature&gt;/page.tsx` mentioning these feature IDs in
            its Traceability docstring. Re-click <strong>Re-generate LLD</strong> to produce a fresh
            artifact (the wrapper now requires an App Router page per feature), or manually edit
            pseudo-files in the editor.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionRow({
  section,
  isRegenerating,
  disabled,
  onRegen,
}: {
  section: LldSectionValidation;
  isRegenerating: boolean;
  disabled: boolean;
  onRegen: () => void;
}) {
  const status = section.contentLen === 0
    ? { label: 'Missing', icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> }
    : { label: `Thin (${section.contentLen} chars)`, icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> };

  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        {status.icon}
        <div className="min-w-0">
          <div className="font-medium truncate">§ {section.sectionLabel}</div>
          <div className="text-muted-foreground">{status.label}</div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRegen}
        disabled={disabled || isRegenerating || section.isHumanModified}
        title={
          section.isHumanModified
            ? 'Section is human-edited — regeneration blocked to preserve edits'
            : 'Regenerate this section (~$0.05, ~30-60 s)'
        }
      >
        {isRegenerating ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
        )}
        Regenerate
      </Button>
    </div>
  );
}
