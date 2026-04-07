'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SECTIONS } from '@/lib/section-config';
import { CheckCircle2, Circle, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

export interface FeatureItem {
  featureId: string;
  featureName: string;
}

interface SidebarProps {
  activeSection: number;
  activeSubTab: string | null;
  activeFeatureId: string | null;
  sectionStatuses: Record<number, 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'>;
  /** Features grouped by module key (e.g., "6.1" → [{featureId, featureName}]) */
  moduleFeatures: Record<string, FeatureItem[]>;
  /** Dynamic sub-module names for Section 6 — keyed by module key (e.g., "6.1" → "Authentication") */
  dynamicModuleNames?: Record<string, string>;
  onSelect: (sectionNumber: number) => void;
  onSubTabSelect: (sectionNumber: number, subTabKey: string) => void;
  onFeatureSelect: (sectionNumber: number, subTabKey: string, featureId: string) => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETE':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'IN_PROGRESS':
      return <Loader2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />;
  }
}

export function Sidebar({
  activeSection,
  activeSubTab,
  activeFeatureId,
  sectionStatuses,
  moduleFeatures,
  dynamicModuleNames,
  onSelect,
  onSubTabSelect,
  onFeatureSelect,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  function toggleSection(num: number) {
    setExpandedSections((prev) => ({ ...prev, [num]: !prev[num] }));
  }

  function toggleModule(key: string) {
    setExpandedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside
      data-testid="prd-sidebar"
      className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto"
    >
      <div className="p-4 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          PRD Sections
        </h2>
      </div>
      <nav className="py-1 text-[13px]">
        {SECTIONS.map((section) => {
          const status = sectionStatuses[section.number] ?? 'NOT_STARTED';
          const isActive = activeSection === section.number;

          // For Section 6: derive sub-modules dynamically from moduleFeatures
          let effectiveSubs: { key: string; label: string }[] = [];
          if (section.number === 6) {
            const keys = Object.keys(moduleFeatures)
              .filter((k) => k.startsWith('6.'))
              .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
            effectiveSubs = keys.map((k) => ({
              key: k,
              label: dynamicModuleNames?.[k] ?? k,
            }));
          } else if (section.subModules && section.subModules.length > 0) {
            effectiveSubs = section.subModules;
          }

          const hasSubs = effectiveSubs.length > 0;
          const isSectionExpanded = expandedSections[section.number] ?? isActive;

          return (
            <div key={section.number}>
              {/* ── Level 1: Section ── */}
              <div className="flex items-center">
                {hasSubs ? (
                  <button
                    onClick={() => toggleSection(section.number)}
                    className="pl-2 pr-0 py-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {isSectionExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-[22px] pl-2" />
                )}
                <button
                  data-testid={`sidebar-section-${section.number}`}
                  onClick={() => {
                    onSelect(section.number);
                    if (hasSubs && !isSectionExpanded) {
                      setExpandedSections((prev) => ({ ...prev, [section.number]: true }));
                    }
                  }}
                  className={cn(
                    'flex-1 flex items-center gap-2 pl-1 pr-3 py-1.5 text-left transition-colors',
                    isActive && !activeSubTab
                      ? 'bg-primary/10 text-primary font-medium'
                      : isActive
                        ? 'text-primary font-medium'
                        : 'text-foreground hover:bg-muted',
                  )}
                >
                  <StatusIcon status={status} />
                  <span className="truncate">
                    {section.number}. {section.shortName}
                  </span>
                </button>
              </div>

              {/* ── Level 2: Modules (sub-tabs) ── */}
              {hasSubs && isSectionExpanded && (
                <div className="ml-5 border-l border-border/50">
                  {effectiveSubs.map((sub) => {
                    const features = moduleFeatures[sub.key] ?? [];
                    const hasFeatures = features.length > 0;
                    const isModuleActive =
                      activeSection === section.number && activeSubTab === sub.key;
                    const isModuleExpanded =
                      expandedModules[sub.key] ?? isModuleActive;

                    return (
                      <div key={sub.key}>
                        <div className="flex items-center">
                          {hasFeatures ? (
                            <button
                              onClick={() => toggleModule(sub.key)}
                              className="pl-2 pr-0 py-1 text-muted-foreground hover:text-foreground"
                            >
                              {isModuleExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          ) : (
                            <span className="w-[18px] pl-2" />
                          )}
                          <button
                            data-testid={`sidebar-sub-${sub.key}`}
                            onClick={() => {
                              onSubTabSelect(section.number, sub.key);
                              if (hasFeatures && !isModuleExpanded) {
                                setExpandedModules((prev) => ({
                                  ...prev,
                                  [sub.key]: true,
                                }));
                              }
                            }}
                            className={cn(
                              'flex-1 flex items-center gap-1.5 pl-1 pr-2 py-1 text-left text-xs transition-colors',
                              isModuleActive && !activeFeatureId
                                ? 'bg-primary/10 text-primary font-medium'
                                : isModuleActive
                                  ? 'text-primary'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                          >
                            <Circle className="h-2 w-2 shrink-0" />
                            <span className="truncate">{sub.label}</span>
                            {hasFeatures && (
                              <span className="ml-auto text-[10px] text-muted-foreground/60">
                                {features.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* ── Level 3: Features ── */}
                        {hasFeatures && isModuleExpanded && (
                          <div className="ml-5 border-l border-border/30">
                            {features.map((feat) => {
                              const isFeatureActive =
                                isModuleActive && activeFeatureId === feat.featureId;
                              return (
                                <button
                                  key={feat.featureId}
                                  data-testid={`sidebar-feat-${feat.featureId}`}
                                  onClick={() =>
                                    onFeatureSelect(
                                      section.number,
                                      sub.key,
                                      feat.featureId,
                                    )
                                  }
                                  className={cn(
                                    'w-full flex items-start gap-1.5 pl-3 pr-2 py-1 text-left text-[11px] leading-tight transition-colors',
                                    isFeatureActive
                                      ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                  )}
                                  title={`${feat.featureId} — ${feat.featureName}`}
                                >
                                  <span className="font-mono shrink-0">{feat.featureId}</span>
                                  <span className="truncate">- {feat.featureName}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
