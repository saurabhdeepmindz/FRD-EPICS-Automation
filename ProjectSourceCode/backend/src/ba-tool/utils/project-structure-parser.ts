/**
 * Parse the "Project Structure" LLD section content into a flat list of
 * relative file paths. Handles two declaration styles (per the skill spec):
 *
 *   1. **Own-line file**:
 *        `  .env.example     # Example env vars for local/dev`
 *        `  ci.yml            # CI/CD pipeline definition`
 *        `  SLABreachAlertServiceTest.java  # Unit tests for service logic`
 *
 *   2. **Parenthesised file list inside a comment**:
 *        `  controllers/     # REST API controllers (DashboardController.java)`
 *        `  service/         # Business logic (SlaBreachAlertService.java, SlaBreachNotificationService.java)`
 *
 * Both styles are supported; files declared in comments are placed under the
 * directory the comment line describes.
 *
 * The parser is tolerant: fenced code-block markers are stripped, extra blank
 * lines are ignored, and it understands indentation (2 or 4 spaces, or tabs)
 * to build a parent directory stack.
 */

export interface ProjectFile {
  /** Path relative to project root, e.g. "backend/controllers/DashboardController.java" */
  path: string;
  /** How the file was discovered — useful for tests and diagnostics */
  source: 'own-line' | 'comment-list';
}

export interface ParsedProjectStructure {
  files: ProjectFile[];
  /** Directory paths (with trailing /), in the order they appear — used for zip
   *  directory entries so empty dirs are preserved. */
  directories: string[];
}

/** Regex that detects a filename inside a parenthesised comment list.
 *  Matches tokens with a dot+extension: `DashboardController.java`, `.env.example`, `ci.yml`. */
const FILE_TOKEN_RE = /\b[\w.-]+\.[A-Za-z0-9]+\b/g;

/** Leading-whitespace detector for indent levels. */
function indentLevel(line: string, unit = 2): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const ws = match[1].replace(/\t/g, '  '); // treat tab as 2 spaces
  return Math.floor(ws.length / unit);
}

/**
 * Strip enclosing fenced code block markers from the Section 12 content.
 * The AI typically wraps the tree in a ``` block.
 */
function stripFenceMarkers(content: string): string {
  const lines = content.split(/\r?\n/);
  // Remove the first line if it's an opening fence
  if (lines.length > 0 && /^\s*```/.test(lines[0])) lines.shift();
  // Remove the last line if it's a closing fence
  if (lines.length > 0 && /^\s*```\s*$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join('\n');
}

/**
 * Primary entry point — parse the Section 12 body.
 */
export function parseProjectStructure(sectionContent: string): ParsedProjectStructure {
  const content = stripFenceMarkers(sectionContent);
  const lines = content.split(/\r?\n/);

  const files: ProjectFile[] = [];
  const directories: string[] = [];
  const seenFiles = new Set<string>();
  const seenDirs = new Set<string>();

  // Directory stack: element at each index stores the directory name (with
  // trailing slash) at that indent level.
  const dirStack: string[] = [];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    // Split line into "content" and "# comment"
    // Only the first `#` not inside quotes counts as the comment marker.
    const hashIdx = findCommentStart(rawLine);
    const beforeHash = hashIdx === -1 ? rawLine : rawLine.substring(0, hashIdx);
    const afterHash = hashIdx === -1 ? '' : rawLine.substring(hashIdx + 1);

    const indent = indentLevel(rawLine);
    const trimmed = beforeHash.trim();
    if (!trimmed) continue;

    // Maintain dir stack: pop until its length <= current indent
    while (dirStack.length > indent) dirStack.pop();

    // A node ending in `/` is a directory
    const isDir = trimmed.endsWith('/');
    if (isDir) {
      const dirName = trimmed;
      // Fill any missing indent levels (e.g. if tree uses inconsistent widths)
      while (dirStack.length < indent) dirStack.push('');
      dirStack.push(dirName);
      // Full path (relative) = concat of non-empty parts
      const fullPath = dirStack.filter(Boolean).join('');
      if (!seenDirs.has(fullPath) && fullPath) {
        directories.push(fullPath);
        seenDirs.add(fullPath);
      }
    } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      // A `(empty)` placeholder under a directory — ignore, the dir was already captured
      continue;
    } else {
      // Own-line file: the trimmed token IS the filename (possibly with a dot
      // prefix like `.env.example`). Ignore obvious prose lines (e.g. a
      // free-form note that slipped in — detect by requiring a dot somewhere).
      if (/[\w.-]+\.[A-Za-z0-9]+/.test(trimmed)) {
        while (dirStack.length < indent) dirStack.push('');
        const parent = dirStack.filter(Boolean).join('');
        const fullPath = parent + trimmed;
        if (!seenFiles.has(fullPath)) {
          files.push({ path: fullPath, source: 'own-line' });
          seenFiles.add(fullPath);
        }
      }
    }

    // Now scan the comment for parenthesised file lists.
    if (afterHash) {
      // Parent path for files mentioned in this line's comment — use current
      // dirStack (which already includes the line's own directory if isDir).
      let parent = dirStack.filter(Boolean).join('');
      // If this line was an own-line file, strip its basename to get its dir.
      if (!isDir && !trimmed.endsWith(')')) {
        // parent already correct — comment files go INTO the same directory as the sibling file
      }
      const commentFiles = extractCommentFiles(afterHash);
      for (const fname of commentFiles) {
        const fullPath = parent + fname;
        if (!seenFiles.has(fullPath)) {
          files.push({ path: fullPath, source: 'comment-list' });
          seenFiles.add(fullPath);
        }
      }
    }
  }

  return { files, directories };
}

/**
 * Find the position of the first `#` that starts an inline comment. Returns
 * -1 if none. A `#` inside the first token (e.g. `#!shebang`) is ignored.
 */
function findCommentStart(line: string): number {
  // Find the first `#` preceded by whitespace or at start-of-trimmed position
  // after at least one non-ws char; otherwise treat as comment-from-start.
  let inQuote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === '#') {
      // If the `#` is at the very start (line is a "# comment"), ignore — no file on this line
      const before = line.substring(0, i).trim();
      if (!before) continue;
      return i;
    }
  }
  return -1;
}

/**
 * Extract filenames from a comment body. We look for:
 *  - Parenthesised lists: `(FileA.java, FileB.java, …)`
 *  - Any bare filename token with a dot extension anywhere in the comment
 *    — useful when the LLM writes `# ...includes DashboardController.java`
 *
 * Deduped within the comment.
 */
function extractCommentFiles(comment: string): string[] {
  const found = new Set<string>();
  // Prefer parenthesised group first — most reliable
  const parenGroups = comment.match(/\(([^)]+)\)/g) ?? [];
  for (const group of parenGroups) {
    const inner = group.slice(1, -1);
    const tokens = inner.match(FILE_TOKEN_RE) ?? [];
    for (const t of tokens) if (looksLikeCodeFile(t)) found.add(t);
  }
  // Fallback: bare tokens elsewhere in the comment
  const bare = comment.match(FILE_TOKEN_RE) ?? [];
  for (const t of bare) if (looksLikeCodeFile(t)) found.add(t);
  return Array.from(found);
}

/**
 * Heuristic: treat a `name.ext` token as a file only if the extension is
 * plausibly a source/config extension. Avoids picking up things like
 * "e.g." or "v1.0" as filenames.
 */
function looksLikeCodeFile(token: string): boolean {
  const m = token.match(/\.([A-Za-z0-9]+)$/);
  if (!m) return false;
  const ext = m[1].toLowerCase();
  // Reject obvious non-file extensions (versions, decimals, abbreviations)
  const REJECT = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'e', 'g', 'i']);
  if (REJECT.has(ext)) return false;
  // Accept 2+ char extension
  return ext.length >= 2 && ext.length <= 10;
}

/**
 * Map a file's extension to a language-appropriate one-line placeholder
 * comment. Used for dummy files in the project-structure zip and for
 * pseudo-files missing from Section 18.
 */
export function placeholderComment(path: string): string {
  const ext = (path.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? '').toLowerCase();
  const msg = 'placeholder file — to be generated in Sprint v5 source-gen';
  switch (ext) {
    case 'py':
    case 'rb':
    case 'sh':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'ini':
    case 'conf':
    case 'gitignore':
    case 'env':
    case 'example':
      return `# ${msg}\n`;
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'java':
    case 'kt':
    case 'scala':
    case 'go':
    case 'c':
    case 'cpp':
    case 'cs':
    case 'swift':
    case 'rs':
    case 'php':
      return `// ${msg}\n`;
    case 'html':
    case 'htm':
    case 'xml':
    case 'svg':
      return `<!-- ${msg} -->\n`;
    case 'css':
    case 'scss':
    case 'less':
      return `/* ${msg} */\n`;
    case 'sql':
      return `-- ${msg}\n`;
    case 'md':
    case 'markdown':
      return `> ${msg}\n`;
    case 'json':
      // JSON has no comment syntax — use an empty object with a noop key
      return `{\n  "_note": "${msg}"\n}\n`;
    default:
      return `# ${msg}\n`;
  }
}
