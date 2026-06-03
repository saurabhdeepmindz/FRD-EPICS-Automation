/**
 * Minimal, dependency-free CSV parse/serialize (Sprint v8 · Track Y).
 * Handles quoted fields, escaped quotes (""), embedded commas, and embedded
 * newlines — needed because the screen-map's annotation column is multi-line.
 */

/** Parse CSV text into rows of string cells (RFC-4180-ish; tolerant of \r\n / \n). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  // last field / row (unless the text ended on a clean newline with no trailing data)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop trailing fully-empty rows
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Quote a single cell if it contains a comma, quote, or newline. */
export function csvCell(value: unknown): string {
  const v = value == null ? '' : String(value);
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Serialize rows (array of string arrays) to CSV text. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
