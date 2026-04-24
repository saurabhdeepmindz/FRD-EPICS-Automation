'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Shared context for resolving cross-references (SCR-XX, MOD-XX, etc.) inside
 * rendered Markdown content. The MarkdownRenderer reads this to turn plain
 * tokens into hyperlinks — e.g.:
 *
 *   - SCR-01 → button that scrolls to `#screen-thumb-SCR-01` in the page
 *   - MOD-03 → link to `/ba-tool/project/{pid}/module/{dbId}` using the
 *     modulesById map
 *
 * When the context is absent (e.g. preview page without sibling context),
 * MarkdownRenderer falls back to the plain styled-token rendering — no
 * broken links are produced.
 */
export interface ArtifactRefModuleEntry {
  moduleDbId: string;
  moduleName: string;
}

export interface ArtifactRefContextValue {
  projectId: string;
  modulesById: Record<string, ArtifactRefModuleEntry>; // key = human moduleId like "MOD-03"
}

const ArtifactRefContext = createContext<ArtifactRefContextValue | null>(null);

export function ArtifactRefProvider({
  value,
  children,
}: {
  value: ArtifactRefContextValue;
  children: ReactNode;
}) {
  return <ArtifactRefContext.Provider value={value}>{children}</ArtifactRefContext.Provider>;
}

/** Returns null when no provider is mounted — callers treat that as "no links". */
export function useArtifactRefs(): ArtifactRefContextValue | null {
  return useContext(ArtifactRefContext);
}
