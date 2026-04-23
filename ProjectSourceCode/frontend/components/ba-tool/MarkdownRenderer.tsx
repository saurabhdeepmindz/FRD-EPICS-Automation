'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

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
  | { type: 'empty' };

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

  const blocks = parseMarkdown(content);

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed', className)}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
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
  }
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
      parts.push(
        <span key={key++} className="font-mono text-primary bg-primary/5 px-1 rounded">
          {idMatch[1]}
        </span>,
      );
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
