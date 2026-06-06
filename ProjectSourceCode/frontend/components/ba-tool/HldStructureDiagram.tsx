'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ProjectStructure } from '@/lib/pipeline-api';
import type { DiagramPalette } from '@/lib/hld-diagram';

/**
 * Pastel project-structure grid (v9 Track KK) — shared by the /hld-v2 browse view
 * and the Preview so both render §17 identically.
 */
export function HldStructureDiagram({
  structure,
  palette,
}: {
  structure: ProjectStructure;
  palette: DiagramPalette;
}) {
  const legend: [keyof DiagramPalette, string][] = [
    ['frontend', 'Frontend'], ['backend', 'Backend'], ['calcEngine', 'Calc Engine'],
    ['shared', 'Shared Pkgs'], ['db', 'DB Tables'], ['config', 'Config / Files'],
  ];
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="text-center text-sm text-gray-500">
          monorepo root — <span className="font-medium text-gray-700">{structure.productName}</span>
        </div>
        {structure.groups.map((g) => {
          const c = palette[g.layer] ?? palette.node;
          return (
            <div key={g.key}>
              <div className="text-sm font-semibold mb-2" style={{ color: c.text }}>{g.title}</div>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it, i) => (
                  <span
                    key={i}
                    className="text-xs rounded-md px-2.5 py-1.5 border"
                    style={{ background: c.fill, borderColor: c.border, color: c.text }}
                  >
                    {it.name}
                    {it.note ? <span className="opacity-60"> · {it.note}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-3 pt-3 border-t">
          {legend.map(([k, label]) => {
            const c = palette[k];
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-3 w-3 rounded-sm border" style={{ background: c.fill, borderColor: c.border }} />
                {label}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
