'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import type { FeatureItem } from '@/components/layout/Sidebar';
import { Stepper } from '@/components/layout/Stepper';
import { SubTabBar } from '@/components/layout/SubTabBar';
import { SectionForm } from '@/components/forms/SectionForm';
import { usePrd } from '@/hooks/usePrd';
import { getSectionMeta, SECTIONS } from '@/lib/section-config';
import { Button } from '@/components/ui/button';
import { ViewSource } from '@/components/forms/ViewSource';
import { Eye, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/** Extract features from section 6 content for sidebar tree */
function extractModuleFeatures(
  content: Record<string, unknown>,
): Record<string, FeatureItem[]> {
  const result: Record<string, FeatureItem[]> = {};
  for (const [key, value] of Object.entries(content)) {
    const match = key.match(/^(\d+\.\d+)_features$/);
    if (match && Array.isArray(value)) {
      const moduleKey = match[1];
      result[moduleKey] = (value as Record<string, string>[]).map((f) => ({
        featureId: f.featureId ?? '',
        featureName: f.featureName ?? '',
      }));
    }
  }
  return result;
}

/** Extract dynamic sub-module tabs from section content (for Section 6) */
function extractDynamicSubModules(
  content: Record<string, unknown>,
): { key: string; label: string }[] {
  const moduleKeys = new Set<string>();
  for (const k of Object.keys(content)) {
    const m = k.match(/^(\d+\.\d+)_/);
    if (m) moduleKeys.add(m[1]);
  }
  return [...moduleKeys]
    .sort((a, b) => {
      const [, aN] = a.split('.');
      const [, bN] = b.split('.');
      return Number(aN) - Number(bN);
    })
    .map((key) => ({
      key,
      label: String(content[`${key}_moduleName`] ?? key),
    }));
}

export default function PrdEditPage() {
  const params = useParams<{ id: string }>();
  const prdId = params.id;
  const { prd, loading, error, sectionStatuses, getSection, saveSection } = usePrd(prdId);

  const [activeSection, setActiveSection] = useState(1);
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);

  const meta = getSectionMeta(activeSection);

  // Dynamic sub-modules for Section 6 — derived from PRD content, not hardcoded
  const section6SubModules = useMemo(() => {
    if (!prd) return [];
    const s6 = prd.sections.find((s) => s.sectionNumber === 6);
    if (!s6) return [];
    return extractDynamicSubModules(s6.content as Record<string, unknown>);
  }, [prd]);

  // For Section 6 use dynamic modules, for Section 10 use static config, for others use meta
  const subModules = useMemo(() => {
    if (activeSection === 6) return section6SubModules;
    return meta?.subModules ?? [];
  }, [activeSection, section6SubModules, meta]);

  // Extract features from Section 6 content for the sidebar tree
  const moduleFeatures = useMemo(() => {
    if (!prd) return {};
    const s6 = prd.sections.find((s) => s.sectionNumber === 6);
    if (!s6) return {};
    return extractModuleFeatures(s6.content as Record<string, unknown>);
  }, [prd]);

  // Dynamic module names for Sidebar (Section 6)
  const dynamicModuleNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const sub of section6SubModules) {
      map[sub.key] = sub.label;
    }
    return map;
  }, [section6SubModules]);

  const handleSectionSelect = useCallback((num: number) => {
    setActiveSection(num);
    setActiveFeatureId(null);
    if (num === 6) {
      // Will be set by the subModules memo on re-render; pick first dynamically
      setActiveSubTab(null); // reset — will auto-pick first in SubTabBar
    } else {
      const sectionMeta = getSectionMeta(num);
      setActiveSubTab(sectionMeta?.subModules?.[0]?.key ?? null);
    }
  }, []);

  // Auto-set Section 6 first sub-tab when subModules update
  useMemo(() => {
    if (activeSection === 6 && !activeSubTab && section6SubModules.length > 0) {
      setActiveSubTab(section6SubModules[0].key);
    }
  }, [activeSection, activeSubTab, section6SubModules]);

  const handlePrevious = useCallback(() => {
    if (activeSection > 1) handleSectionSelect(activeSection - 1);
  }, [activeSection, handleSectionSelect]);

  const handleNext = useCallback(() => {
    if (activeSection < 22) handleSectionSelect(activeSection + 1);
  }, [activeSection, handleSectionSelect]);

  const handleSave = useCallback(
    async (content: Record<string, unknown>, aiSuggested: boolean) => {
      await saveSection(activeSection, content, aiSuggested);
    },
    [activeSection, saveSection],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading PRD...</span>
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

  const currentSection = getSection(activeSection);
  const currentContent = (currentSection?.content as Record<string, unknown>) ?? {};

  // Resolve active sub-tab: if null and subModules exist, pick first
  const resolvedSubTab = activeSubTab ?? (subModules.length > 0 ? subModules[0].key : null);

  return (
    <div className="flex h-screen flex-col" data-testid="prd-editor">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{prd.productName}</h1>
            <p className="text-xs text-muted-foreground">{prd.prdCode} — v{prd.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
            {prd.status}
          </span>
          <ViewSource prdId={prdId} />
          <Button size="sm" variant="outline" asChild>
            <Link href={`/prd/${prdId}/preview`}>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Link>
          </Button>
        </div>
      </header>

      {/* Stepper */}
      <Stepper
        activeSection={activeSection}
        sectionStatuses={sectionStatuses}
        onSelect={handleSectionSelect}
      />

      {/* Sub-tabs (for sections with sub-modules) */}
      {subModules.length > 0 && (
        <SubTabBar
          tabs={subModules}
          activeTab={resolvedSubTab ?? subModules[0].key}
          onSelect={(key) => {
            setActiveSubTab(key);
            setActiveFeatureId(null);
          }}
        />
      )}

      {/* Main content: Sidebar + Form */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSection={activeSection}
          activeSubTab={resolvedSubTab}
          activeFeatureId={activeFeatureId}
          sectionStatuses={sectionStatuses}
          moduleFeatures={moduleFeatures}
          dynamicModuleNames={dynamicModuleNames}
          onSelect={handleSectionSelect}
          onSubTabSelect={(num, key) => {
            setActiveSection(num);
            setActiveSubTab(key);
            setActiveFeatureId(null);
          }}
          onFeatureSelect={(num, subKey, featId) => {
            setActiveSection(num);
            setActiveSubTab(subKey);
            setActiveFeatureId(featId);
          }}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          <SectionForm
            key={`${prdId}-${activeSection}-${resolvedSubTab}-${activeFeatureId}`}
            prdId={prdId}
            sectionNumber={activeSection}
            initialContent={currentContent}
            onSave={handleSave}
            onPrevious={activeSection > 1 ? handlePrevious : undefined}
            onNext={activeSection < SECTIONS.length ? handleNext : undefined}
            activeSubTab={resolvedSubTab ?? undefined}
            activeFeatureId={activeFeatureId ?? undefined}
            onFeatureSelect={(featId) => {
              setActiveFeatureId(featId);
            }}
          />
        </main>
      </div>
    </div>
  );
}
