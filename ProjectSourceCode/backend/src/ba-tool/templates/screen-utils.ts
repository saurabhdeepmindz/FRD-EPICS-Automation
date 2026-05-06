/**
 * Tiny screen-reference helpers shared by the FRD restructurer and the DOCX
 * exporter. Server-side mirror of `frontend/components/ba-tool/ScreensGallery`
 * `extractScreenIds` so we don't pull a frontend file into the backend tree.
 */

export function extractScreenIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/\bSCR-\d+\b/g)) out.add(m[0]);
  return Array.from(out);
}
