'use client';

/**
 * PrdSidebar (Sprint v7 · Track X · Task 7).
 * Left "PRD SECTIONS" checklist with authoring-status ticks + a §6 module/feature
 * tree (derived from the `6.N_*` keys). Selecting a section/feature opens it.
 */

import { CheckCircle2, Loader2, Circle, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PRD_SECTION_NAMES, type SectionStatus, type ReviewStatus } from '@/lib/pipeline-api';

interface PrdSidebarProps {
  activeKey: string;
  statuses: Record<string, SectionStatus>;
  review?: Record<string, ReviewStatus>;
  sections: Record<string, Record<string, unknown>>;
  onSelect: (key: string) => void;
}

function StatusIcon({ status, review }: { status: SectionStatus; review?: ReviewStatus }) {
  if (review) {
    if (review === 'accepted' || review === 'edited')
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
    if (review === 'skipped') return <Circle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
    return <Circle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  }
  if (status === 'COMPLETE') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
  if (status === 'IN_PROGRESS') return <Loader2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />;
}

/** Group §6 body into modules → feature labels. */
function frdModules(body: Record<string, unknown> | undefined): { id: string; name: string; features: string[] }[] {
  if (!body) return [];
  const map: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(body)) {
    const m = k.match(/^(6\.\d+)_(.+)$/);
    if (m) (map[m[1]] ??= {})[m[2]] = v;
  }
  return Object.keys(map)
    .sort()
    .map((mk) => {
      const mod = map[mk];
      const feats = Array.isArray(mod.features) ? (mod.features as Record<string, unknown>[]) : [];
      return {
        id: (mod.moduleId as string) ?? mk,
        name: (mod.moduleName as string) ?? mk,
        features: feats.map((f) => (f.featureId as string) ?? (f.featureName as string) ?? '·').filter(Boolean),
      };
    });
}

export function PrdSidebar({ activeKey, statuses, review, sections, onSelect }: PrdSidebarProps) {
  const [frdOpen, setFrdOpen] = useState(activeKey === '6');

  return (
    <nav className="w-56 shrink-0 border-r bg-gray-50/60 overflow-y-auto">
      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        PRD Sections
      </p>
      <ul className="pb-4">
        {Array.from({ length: 22 }, (_, i) => String(i + 1)).map((key) => {
          const active = key === activeKey;
          const isFrd = key === '6';
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => {
                  onSelect(key);
                  if (isFrd) setFrdOpen(true);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs ${
                  active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <StatusIcon status={statuses[key] ?? 'NOT_STARTED'} review={review?.[key]} />
                <span className="text-gray-400 font-mono w-4">{key}</span>
                <span className="truncate">{PRD_SECTION_NAMES[key] ?? `Section ${key}`}</span>
                {isFrd && (
                  <span className="ml-auto" onClick={(e) => { e.stopPropagation(); setFrdOpen((o) => !o); }}>
                    {frdOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </span>
                )}
              </button>
              {isFrd && frdOpen && (
                <ul className="pl-7 pr-2 pb-1">
                  {frdModules(sections['6']).map((mod) => (
                    <li key={mod.id} className="py-0.5">
                      <button
                        type="button"
                        onClick={() => onSelect('6')}
                        className="text-[11px] text-gray-500 hover:text-blue-600 font-mono"
                      >
                        {mod.id} · {mod.name}
                      </button>
                      {mod.features.length > 0 && (
                        <span className="text-[10px] text-gray-400"> ({mod.features.length})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
