/**
 * Deterministic post-processor for Mermaid blocks emitted by SKILL-06-LLD
 * (and any other skill that outputs Mermaid). Fixes the most common
 * AI-generated syntax issues that cause "Syntax error in text" failures
 * in the frontend Mermaid renderer.
 *
 * Two known failure modes the AI consistently produces:
 *
 *   1. `graph` / `flowchart` blocks — node labels containing parens,
 *      slashes, ampersands, colons, hashes, or other reserved chars,
 *      emitted UNQUOTED:
 *
 *          A[ResearchChatController/Service]   ← slash crashes mermaid 11+
 *          F[PaymentServiceClient (TBD)]       ← parens crash mermaid
 *
 *      Fix: wrap the bracket contents in double-quotes when any of those
 *      chars appears, becoming
 *          A["ResearchChatController/Service"]
 *          F["PaymentServiceClient (TBD)"]
 *
 *   2. `erDiagram` blocks — capitalised SQL-ish column types like
 *      `UUID`, `String`, `DateTime`, `Decimal`, `Enum`, `Text` are not
 *      recognised by mermaid 11's erDiagram parser (lowercase ones are).
 *
 *      Fix: lowercase known SQL types inside erDiagram column lines,
 *      and rewrite `Enum` to `string` (Mermaid has no enum primitive).
 *
 * The sanitizer is line-aware and idempotent — running it twice produces
 * the same output. It only touches content INSIDE ```mermaid fenced
 * blocks, so prose / non-Mermaid markdown is untouched.
 */

const UNSAFE_LABEL_CHARS = /[()/&#:|{}]/;

/**
 * Quote node labels in `[Label]` brackets when the label contains
 * characters that need escaping in graph/flowchart syntax. Already-
 * quoted labels are left alone.
 *
 * Matches `<Identifier>[<label>]` or `<Identifier>(<label>)` etc. — the
 * common Mermaid graph node shapes. Conservative: only touches the
 * standard `[ ]` rectangle shape since that's where the AI's broken
 * output lives.
 */
function quoteUnsafeGraphLabels(line: string): string {
  return line.replace(/(\b[A-Za-z_][A-Za-z0-9_]*)\[([^\]"]+)\]/g, (full, id, label) => {
    if (!UNSAFE_LABEL_CHARS.test(label)) return full;
    // Already quoted? (defensive — shouldn't match because we excluded `"` from the inner class)
    if (/^".*"$/.test(label.trim())) return full;
    // Escape any bare double-quote chars inside the label before wrapping.
    const safe = label.replace(/"/g, '#quot;');
    return `${id}["${safe}"]`;
  });
}

const ER_DIAGRAM_TYPE_REWRITES: Record<string, string> = {
  UUID: 'uuid',
  String: 'string',
  Text: 'text',
  Integer: 'int',
  Int: 'int',
  Decimal: 'decimal',
  Float: 'float',
  Double: 'double',
  Boolean: 'boolean',
  Bool: 'boolean',
  Date: 'date',
  DateTime: 'datetime',
  Datetime: 'datetime',
  Timestamp: 'timestamp',
  Time: 'time',
  Binary: 'binary',
  Blob: 'blob',
  // `Enum` has no Mermaid equivalent — collapse to `string`.
  Enum: 'string',
};

/**
 * Inside an erDiagram, a column declaration line looks like:
 *   `  UUID userId FK`   →  `  uuid userId FK`
 *   `  Enum status`      →  `  string status`
 *
 * We rewrite ONLY the leading type token (first word on a non-blank,
 * non-relationship, non-table-header line). Relationship lines like
 * `ResearchChat ||--o{ AIResponse : contains` and table headers
 * `ResearchChat {` are left alone.
 */
function lowercaseErDiagramTypes(line: string): string {
  // Skip lines that aren't column declarations.
  const trimmed = line.trim();
  if (!trimmed) return line;
  if (trimmed.endsWith('{') || trimmed === '}') return line;
  if (trimmed.startsWith('%%')) return line;
  // Mermaid relationship line uses cardinality tokens in the middle.
  if (/\|\||--|\.\.|\}o|\{o|o\{|o\|/.test(trimmed)) return line;
  // Match leading-type token: indentation + Type + space + rest
  const match = line.match(/^(\s*)([A-Z][A-Za-z0-9]*)(\s+\S+.*)$/);
  if (!match) return line;
  const [, indent, typeToken, rest] = match;
  const replacement = ER_DIAGRAM_TYPE_REWRITES[typeToken];
  if (!replacement) return line;
  return `${indent}${replacement}${rest}`;
}

/**
 * Sanitize a single Mermaid block body (the text between ```mermaid and
 * ```). Returns the cleaned body. The opening directive line (e.g.
 * `graph TD`, `erDiagram`, `sequenceDiagram`) determines which fixes
 * apply.
 */
export function sanitizeMermaidBody(body: string): string {
  const lines = body.split(/\r?\n/);
  // Find the opening directive (first non-blank, non-comment line).
  const directiveLine = lines.find((l) => l.trim() && !l.trim().startsWith('%%'));
  const directive = directiveLine?.trim().toLowerCase() ?? '';

  const isGraph = /^(graph|flowchart)\s/.test(directive);
  const isErDiagram = /^erdiagram\b/.test(directive);

  if (!isGraph && !isErDiagram) return body; // class/sequence/etc.: pass-through

  const out = lines.map((line) => {
    if (isGraph) return quoteUnsafeGraphLabels(line);
    if (isErDiagram) return lowercaseErDiagramTypes(line);
    return line;
  });
  return out.join('\n');
}

/**
 * Walk a markdown string, find every ```mermaid fenced block, and run
 * `sanitizeMermaidBody` on each. Returns the rewritten markdown. Other
 * fenced blocks (typescript, sql, etc.) and plain prose are untouched.
 */
export function sanitizeMermaidInMarkdown(markdown: string): string {
  return markdown.replace(/```mermaid([\s\S]*?)```/g, (_full, body: string) => {
    const cleaned = sanitizeMermaidBody(body);
    return `\`\`\`mermaid${cleaned}\`\`\``;
  });
}
