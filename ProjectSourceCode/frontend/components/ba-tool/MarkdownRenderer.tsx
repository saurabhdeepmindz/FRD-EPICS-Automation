'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useArtifactRefs } from './ArtifactRefContext';

const MERMAID_LANGUAGES = new Set(['mermaid', 'uml']);

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Force plain text rendering (no markdown parsing) */
  plain?: boolean;
}

type Block =
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code'; language: string; content: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'separator' }
  | { type: 'empty' }
  // KV-table: 2-col Key/Value table, used for Traceability headers
  // and Section 20 Project Structure (everything but Directory Map).
  | { type: 'kv_table'; title?: string; rows: Array<[string, string]> }
  // Tree art (e.g. Directory Map under Project Structure). Rendered as
  // monospace <pre> so the box-drawing characters align.
  | { type: 'tree'; title?: string; lines: string[] };

/**
 * Renders markdown content with proper formatting for tables, code blocks,
 * lists, headings, and inline formatting.
 */
export function MarkdownRenderer({ content, className, plain }: MarkdownRendererProps) {
  if (plain || !content) {
    return (
      <div className={cn('whitespace-pre-wrap text-sm leading-relaxed', className)}>
        {content}
      </div>
    );
  }

  const blocks = postProcessBlocks(parseMarkdown(content));

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed', className)}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
}

// ─── Post-processing ────────────────────────────────────────────────────────
//
// Convert specific paragraph and code blocks into specialized renderers:
//   1. Traceability /* ... */ comment blocks  → 2-col Key/Value table
//   2. "Project Structure:" KV blocks         → 2-col Key/Value table
//   3. "Directory Map:" tree-art blocks       → monospace <pre>
//
// All three are detected by content shape, not by section heading, so they
// keep working when the AI emits them in slightly different positions.

function postProcessBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    // Traceability: fenced code containing a /* ... */ KV comment.
    // Returns one or more KV-table groups — typically:
    //   1. main Traceability metadata
    //   2. TBD-Future Dependencies sub-table (split on the "TBD-Future
    //      Dependencies:" header line)
    if (b.type === 'code') {
      const groups = extractKvGroups(b.content.split('\n'));
      if (groups && allRowsLookLikeTraceability(groups)) {
        for (const g of groups) {
          out.push({ type: 'kv_table', title: g.title ?? 'Traceability', rows: g.rows });
        }
        continue;
      }
      // Project Structure inside a fenced block (e.g. ```text\nProject
      // Structure:\n  ...```). The AI sometimes wraps Section 20 in a fence
      // to preserve indentation; treat the body as if it were a paragraph
      // so the KV-table + tree rendering still fires.
      const psFenced = extractProjectStructureBlock(b.content);
      if (psFenced) {
        if (psFenced.kv && psFenced.kv.length > 0) {
          out.push({ type: 'kv_table', title: 'Project Structure', rows: psFenced.kv });
        }
        if (psFenced.treeLines && psFenced.treeLines.length > 0) {
          out.push({ type: 'tree', title: 'Directory Map', lines: psFenced.treeLines });
        }
        if (psFenced.remainder.trim()) {
          out.push({ type: 'paragraph', text: psFenced.remainder });
        }
        continue;
      }
    }
    // Bare /* ... */ Traceability comment — emitted by SKILL-05 for FE
    // SubTasks WITHOUT a surrounding ```text fence. Detected here in the
    // paragraph branch (the fenced equivalent is handled above in 'code').
    if (b.type === 'paragraph') {
      const t = b.text.trim();
      if (t.startsWith('/*') && /\*\//.test(t)) {
        const groups = extractKvGroups(b.text.split('\n'));
        if (groups && allRowsLookLikeTraceability(groups)) {
          for (const g of groups) {
            out.push({ type: 'kv_table', title: g.title ?? 'Traceability', rows: g.rows });
          }
          continue;
        }
      }
    }
    // Project Structure: paragraph starting with "Project Structure:" plus KV lines
    if (b.type === 'paragraph') {
      const ps = extractProjectStructureBlock(b.text);
      if (ps) {
        if (ps.kv) {
          out.push({ type: 'kv_table', title: 'Project Structure', rows: ps.kv });
        }
        if (ps.treeLines && ps.treeLines.length > 0) {
          out.push({ type: 'tree', title: 'Directory Map', lines: ps.treeLines });
        }
        if (ps.remainder.trim()) {
          out.push({ type: 'paragraph', text: ps.remainder });
        }
        continue;
      }
      // Standalone Directory Map: paragraph (no preceding Project Structure)
      const dm = extractDirectoryMapOnly(b.text);
      if (dm) {
        out.push({ type: 'tree', title: 'Directory Map', lines: dm.lines });
        if (dm.remainder.trim()) out.push({ type: 'paragraph', text: dm.remainder });
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

// Parse a paragraph beginning with "Project Structure:" — return a KV row list,
// the immediately-following Directory Map tree lines (if present), and any
// remaining text as a paragraph. Returns null when the pattern doesn't match.
function extractProjectStructureBlock(
  text: string,
): { kv: Array<[string, string]> | null; treeLines: string[]; remainder: string } | null {
  const lines = text.split('\n');
  // First non-empty line must be "Project Structure:"
  const firstIdx = lines.findIndex((l) => l.trim());
  if (firstIdx < 0) return null;
  if (!/^\s*project\s+structure\s*:?\s*$/i.test(lines[firstIdx])) return null;

  const rows: Array<[string, string]> = [];
  let i = firstIdx + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) {
      // Blank line — peek ahead to see if "Directory Map:" follows
      if (rows.length > 0) break;
      continue;
    }
    // KV line: leading whitespace, Key (alphanumeric/space/slash), then `:` then value
    const m = /^\s*([A-Za-z][\w\s/().\-]+?)\s*:\s+(.+)$/.exec(l);
    if (m) {
      rows.push([m[1].trim(), m[2].trim()]);
      continue;
    }
    // Hit a non-KV line — stop the KV pass
    break;
  }
  if (rows.length < 2) return null;

  // Tree section detection: skip blanks, then look for "Directory Map:" header
  while (i < lines.length && !lines[i].trim()) i++;
  let treeLines: string[] = [];
  if (i < lines.length && /^\s*directory\s+map\s*:?\s*$/i.test(lines[i])) {
    i++;
    while (i < lines.length) {
      // Tree art lines: contain box-drawing chars OR are indented continuation
      const l = lines[i];
      if (!l.trim()) {
        // Allow a single blank line inside a tree, then stop on the next blank
        if (treeLines.length === 0) break;
        treeLines.push('');
        i++;
        continue;
      }
      treeLines.push(l);
      i++;
    }
    // Trim trailing blanks
    while (treeLines.length > 0 && !treeLines[treeLines.length - 1].trim()) treeLines.pop();
  }

  const remainder = lines.slice(i).join('\n');
  return { kv: rows, treeLines, remainder };
}

function extractDirectoryMapOnly(
  text: string,
): { lines: string[]; remainder: string } | null {
  const lines = text.split('\n');
  const firstIdx = lines.findIndex((l) => l.trim());
  if (firstIdx < 0) return null;
  if (!/^\s*directory\s+map\s*:?\s*$/i.test(lines[firstIdx])) return null;
  const tree: string[] = [];
  let i = firstIdx + 1;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) break;
    tree.push(l);
    i++;
  }
  if (tree.length < 2) return null;
  return { lines: tree, remainder: lines.slice(i).join('\n') };
}

// Extract KV groups from a list of lines that may be a /* ... */ comment
// block (Traceability) or plain key:value lines. Splits on a "TBD-Future
// Dependencies:" header line so the AI's two-section authoring (main
// metadata + TBD sub-block) becomes two distinct tables. Mirrors the backend
// extractKvBlockAsGroups in ba-artifact-export.service.ts.
function extractKvGroups(
  rawLines: string[],
): Array<{ title: string | null; rows: Array<[string, string]> }> | null {
  const cleaned = rawLines.map((l) =>
    l
      .replace(/^\s*\/\*+/, '')
      .replace(/\*\/\s*$/, '')
      .replace(/^\s*\*\s?/, '')
      .replace(/\s+$/, ''),
  );
  const nonEmpty = cleaned.filter((l) => l.trim() && !/^=+$/.test(l.trim()));
  const kvLines = nonEmpty.filter((l) => /^[\w\s().\-/]+:\s*\S/.test(l));
  if (nonEmpty.length < 3 || kvLines.length / nonEmpty.length < 0.6) return null;

  const groups: Array<{ title: string | null; rows: Array<[string, string]> }> = [];
  let currentTitle: string | null = null;
  let currentRows: Array<[string, string]> = [];
  const flush = () => {
    if (currentRows.length > 0) {
      groups.push({ title: currentTitle, rows: currentRows });
    }
    currentTitle = null;
    currentRows = [];
  };

  for (const l of cleaned) {
    const t = l.trim();
    if (!t) continue;
    if (/^=+$/.test(t)) continue;
    if (/^TBD[-\s]Future\s+Dependencies\s*:?\s*$/i.test(t)) {
      flush();
      currentTitle = 'TBD-Future Dependencies';
      continue;
    }
    const kv = /^([^:]+):\s*(.*)$/.exec(l);
    if (kv && kv[2].trim()) {
      currentRows.push([kv[1].trim(), kv[2].trim()]);
    } else if (!currentTitle && !/^\/\*|\*\/$/.test(t)) {
      currentTitle = t.replace(/^\/\*+/, '').replace(/\*\/$/, '').trim();
    }
  }
  flush();
  if (groups.length === 0) return null;
  return groups;
}

// Distinguish a Traceability block (Module:/Feature:/User Story:/Epic:) from
// a generic KV list — keeps the renderer from converting random `Note: ...`
// code blocks into tables. Inspects keys across all groups so a Traceability
// block whose main metadata is in one group and TBD-Future is in another
// still matches.
function allRowsLookLikeTraceability(
  groups: Array<{ rows: Array<[string, string]> }>,
): boolean {
  const keys = groups.flatMap((g) => g.rows.map(([k]) => k.toLowerCase()));
  let hits = 0;
  for (const k of ['module', 'feature', 'user story', 'epic', 'package', 'screen']) {
    if (keys.some((x) => x.startsWith(k))) hits++;
  }
  return hits >= 3;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseMarkdown(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    // Horizontal separator
    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: 'separator' });
      i++;
      continue;
    }

    // Fenced code block ```lang ... ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', language, content: codeLines.join('\n') });
      continue;
    }

    // Markdown table — detect by checking for | in current and | --- | in next line
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1].trim())) {
      const headers = parseTableRow(trimmed);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = parseTableRow(lines[i].trim());
        if (row.length > 0) rows.push(row);
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph — accumulate until empty line or block boundary
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) break;
      if (/^---+$/.test(next)) break;
      if (next.startsWith('#')) break;
      if (next.startsWith('```')) break;
      if (next.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1]?.trim() ?? '')) break;
      if (/^[-*+]\s+/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
  }

  return blocks;
}

function parseTableRow(line: string): string[] {
  // Strip leading/trailing | and split, preserving empty cells
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((cell) => cell.trim());
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case 'table':
      return <TableBlock key={key} headers={block.headers} rows={block.rows} />;
    case 'code':
      return <CodeBlock key={key} language={block.language} content={block.content} />;
    case 'list':
      return <ListBlock key={key} ordered={block.ordered} items={block.items} />;
    case 'heading':
      return <HeadingBlock key={key} level={block.level} text={block.text} />;
    case 'paragraph':
      return <ParagraphBlock key={key} text={block.text} />;
    case 'separator':
      return <hr key={key} className="border-border my-2" />;
    case 'empty':
      return null;
    case 'kv_table':
      return <KvTableBlock key={key} title={block.title} rows={block.rows} />;
    case 'tree':
      return <TreeBlock key={key} title={block.title} lines={block.lines} />;
  }
}

function KvTableBlock({ title, rows }: { title?: string; rows: Array<[string, string]> }) {
  return (
    <div className="my-2 overflow-x-auto">
      {title && (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {title}
        </div>
      )}
      <table className="w-full text-xs border-collapse border border-border rounded-md">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className={cn('hover:bg-muted/30 transition-colors', i % 2 === 1 && 'bg-muted/10')}>
              <th
                scope="row"
                className="border border-border px-3 py-1.5 text-left align-top font-semibold text-foreground bg-muted/30 w-1/3"
              >
                {renderInline(k)}
              </th>
              <td className="border border-border px-3 py-1.5 align-top">{renderCell(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TreeBlock({ title, lines }: { title?: string; lines: string[] }) {
  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      {title && (
        <div className="px-3 py-1 bg-muted/50 border-b border-border text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
      )}
      <pre className="px-3 py-2 bg-muted/10 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
        <code>{lines.join('\n')}</code>
      </pre>
    </div>
  );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse border border-border rounded-md">
        <thead>
          <tr className="bg-muted/60">
            {headers.map((h, i) => (
              <th key={i} className="border border-border px-3 py-2 text-left font-semibold text-foreground">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={cn('hover:bg-muted/30 transition-colors', ri % 2 === 1 && 'bg-muted/10')}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-3 py-1.5 align-top">
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(cell: string): React.ReactNode {
  // Highlight TBD-Future markers
  if (cell.includes('TBD-Future')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-medium text-[11px]">
        {renderInline(cell)}
      </span>
    );
  }
  // Highlight status values
  if (/^(CONFIRMED|CONFIRMED-PARTIAL|DRAFT|APPROVED|IMPLEMENTED)$/.test(cell.trim())) {
    const status = cell.trim();
    const cls = status === 'CONFIRMED' || status === 'APPROVED' ? 'bg-green-100 text-green-700'
      : status.includes('PARTIAL') || status === 'DRAFT' ? 'bg-amber-100 text-amber-700'
      : 'bg-blue-100 text-blue-700';
    return <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold', cls)}>{status}</span>;
  }
  // Feature/Story/EPIC/SubTask IDs in monospace
  if (/^(F-\d+-\d+|US-\d+|EPIC-\d+|ST-[A-Z0-9-]+|MOD-\d+|SCR-\d+|TBD-\d+|BR-\d+|TC-[A-Z0-9-]+)$/.test(cell.trim())) {
    return <span className="font-mono text-primary">{cell}</span>;
  }
  return renderInline(cell);
}

function CodeBlock({ language, content }: { language: string; content: string }) {
  const langLower = (language || '').toLowerCase().trim();
  const firstTok = langLower.split(/\s+/)[0];
  const isMermaidLang = MERMAID_LANGUAGES.has(firstTok);
  // Also treat content that starts with a known Mermaid diagram keyword as
  // Mermaid even when the language tag was missing (defensive — LLMs sometimes
  // drop the ` ```mermaid ` tag and put the diagram body straight in a fence).
  const looksLikeMermaid = /^(classDiagram|sequenceDiagram|erDiagram|flowchart|graph|stateDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|c4|requirementDiagram)\b/.test(content.trim());
  if (isMermaidLang || looksLikeMermaid) {
    return <MermaidBlock content={content} />;
  }
  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      {language && (
        <div className="px-3 py-1 bg-muted/50 border-b border-border text-[10px] font-mono text-muted-foreground uppercase">
          {language}
        </div>
      )}
      <pre className="px-3 py-2 bg-muted/20 text-xs font-mono overflow-x-auto leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

/**
 * Render a Mermaid diagram client-side. Falls back to showing the raw fenced
 * code block on parse / render error. Mermaid is loaded dynamically so the
 * library only ships on pages that actually use it.
 */
function MermaidBlock({ content }: { content: string }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        const { svg } = await mermaid.render(`mm-${id}`, content);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Mermaid render failed');
      }
    })();
    return () => { cancelled = true; };
  }, [content, id]);

  if (error) {
    return (
      <div className="my-2 rounded-md border border-amber-300 overflow-hidden">
        <div className="px-3 py-1 bg-amber-50 border-b border-amber-300 text-[10px] text-amber-800 uppercase tracking-wider flex items-center justify-between">
          <span>mermaid — render failed</span>
          <span className="text-[9px] normal-case text-amber-700" title={error}>fallback to source</span>
        </div>
        <pre className="px-3 py-2 bg-amber-50/50 text-xs font-mono overflow-x-auto">
          <code>{content}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      <div className="px-3 py-1 bg-muted/50 border-b border-border text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        mermaid diagram
      </div>
      {svg ? (
        // React disallows mixing children with dangerouslySetInnerHTML on the
        // same element — keep them on separate branches.
        <div
          ref={ref}
          className="px-3 py-3 bg-white overflow-x-auto flex justify-center items-center min-h-[60px]"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div
          ref={ref}
          className="px-3 py-3 bg-white overflow-x-auto flex justify-center items-center min-h-[60px]"
        >
          <span className="text-xs text-muted-foreground">Rendering diagram…</span>
        </div>
      )}
    </div>
  );
}

function ListBlock({ ordered, items }: { ordered: boolean; items: string[] }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={cn('pl-5 space-y-1 my-1', ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {renderInline(item)}
        </li>
      ))}
    </Tag>
  );
}

function HeadingBlock({ level, text }: { level: number; text: string }) {
  const sizeCls = level === 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold';
  return <div className={cn(sizeCls, 'mt-3 mb-1 text-foreground')}>{renderInline(text)}</div>;
}

function ParagraphBlock({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap">{renderInline(text)}</div>;
}

// ─── Inline formatting (bold, italic, code, links, IDs) ──────────────────────

function renderInline(text: string): React.ReactNode {
  // Tokenize by **bold**, *italic*, `code`, and ID patterns
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // **bold**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    // `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="font-mono text-xs bg-muted/40 text-primary px-1 py-0.5 rounded">
          {codeMatch[1]}
        </code>,
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    // *italic* (but not **)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch && !remaining.startsWith('**')) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    // Feature/Story/EPIC/SubTask IDs inline
    const idMatch = remaining.match(/^(F-\d+-\d+|US-\d+|EPIC-\d+|ST-[A-Z0-9-]+|MOD-\d+|SCR-\d+|TBD-\d+|BR-\d+|TC-[A-Z0-9-]+)(?![A-Za-z0-9-])/);
    if (idMatch) {
      const token = idMatch[1];
      if (/^SCR-\d+$/.test(token)) {
        parts.push(<ScreenRefToken key={key++} screenId={token} />);
      } else if (/^MOD-\d+$/.test(token)) {
        parts.push(<ModuleRefToken key={key++} moduleId={token} />);
      } else {
        parts.push(
          <span key={key++} className="font-mono text-primary bg-primary/5 px-1 rounded">
            {token}
          </span>,
        );
      }
      remaining = remaining.slice(idMatch[0].length);
      continue;
    }
    // Plain text until next special char
    const plainMatch = remaining.match(/^[^*`F-UEMTSRB]+/);
    if (plainMatch) {
      parts.push(plainMatch[0]);
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }
    // Single char fallback
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Hyperlinked ID tokens ───────────────────────────────────────────────────

/**
 * Clickable SCR-XX token. Scrolls to `#screen-thumb-SCR-XX` in the current
 * page and flashes a highlight. Falls back to a plain styled span when no
 * such element exists (e.g. preview pages without a screens gallery).
 */
function ScreenRefToken({ screenId }: { screenId: string }) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (typeof document === 'undefined') return;
    const target = document.getElementById(`screen-thumb-${screenId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash highlight without clobbering any existing classes.
    target.classList.add('ring-2', 'ring-primary');
    window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary'), 1600);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="font-mono text-primary bg-primary/5 hover:bg-primary/15 px-1 rounded underline-offset-2 hover:underline cursor-pointer"
      title={`Jump to ${screenId} in the Referenced Screens section`}
    >
      {screenId}
    </button>
  );
}

/**
 * Clickable MOD-XX token. When an ArtifactRefContext is mounted (e.g. inside
 * a module page) and the moduleId maps to a known sibling module, renders a
 * Next.js Link to that module's workspace. Otherwise renders as a plain
 * styled span so no broken links are produced.
 */
function ModuleRefToken({ moduleId }: { moduleId: string }) {
  const refs = useArtifactRefs();
  const entry = refs?.modulesById[moduleId];
  if (!refs || !entry) {
    return (
      <span
        className="font-mono text-primary bg-primary/5 px-1 rounded"
        title={`${moduleId} — module reference`}
      >
        {moduleId}
      </span>
    );
  }
  return (
    <Link
      href={`/ba-tool/project/${refs.projectId}/module/${entry.moduleDbId}`}
      className="font-mono text-primary bg-primary/5 hover:bg-primary/15 px-1 rounded underline-offset-2 hover:underline"
      title={`Open ${moduleId} — ${entry.moduleName}`}
    >
      {moduleId}
    </Link>
  );
}
