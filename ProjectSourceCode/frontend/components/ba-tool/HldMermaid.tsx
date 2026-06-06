'use client';

import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { applyDiagramPalette, type DiagramPalette } from '@/lib/hld-diagram';

/**
 * Mermaid renderer (Sprint v10) — dynamic import, pastel theme derived from the
 * project's diagram palette, per-layer classDef injection, source fallback.
 * Shared by /hld-v2 and HldPreview.
 */
export function HldMermaid({ content, palette }: { content: string; palette: DiagramPalette }) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          themeVariables: {
            fontFamily: 'Inter, system-ui, sans-serif',
            primaryColor: palette.frontend.fill,
            primaryBorderColor: palette.frontend.border,
            primaryTextColor: palette.node.text,
            secondaryColor: palette.backend.fill,
            tertiaryColor: palette.calcEngine.fill,
            lineColor: palette.node.border,
            clusterBkg: '#FBFAFE',
            clusterBorder: palette.node.border,
            nodeBorder: palette.node.border,
            mainBkg: palette.node.fill,
            titleColor: palette.node.text,
            edgeLabelBackground: '#FFFFFF',
          },
        });
        const themed = applyDiagramPalette(content, palette);
        const { svg } = await mermaid.render(`hldv2-${id}`, themed);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Mermaid render failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, id, palette]);

  if (error) {
    return (
      <pre className="text-xs bg-amber-50 border border-amber-200 rounded p-2 overflow-x-auto text-amber-800">
        {content}
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-xs py-6 justify-center">
        <Loader2 className="h-3 w-3 animate-spin" /> Rendering diagram…
      </div>
    );
  }
  return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
