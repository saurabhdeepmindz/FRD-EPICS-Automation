import { parseCsv, csvCell, toCsv } from './csv-util';

describe('csv-util (Track Y)', () => {
  describe('parseCsv', () => {
    it('parses a simple grid', () => {
      expect(parseCsv('a,b,c\n1,2,3')).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]);
    });

    it('handles quoted fields with embedded commas', () => {
      expect(parseCsv('id,desc\nSCR-01,"Landing, home"')).toEqual([
        ['id', 'desc'],
        ['SCR-01', 'Landing, home'],
      ]);
    });

    it('handles escaped quotes ("")', () => {
      expect(parseCsv('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
    });

    it('handles embedded newlines inside quotes (annotation column)', () => {
      const csv = 'screen,annotations\nSCR-01,"1 | A\n2 | B"';
      expect(parseCsv(csv)).toEqual([
        ['screen', 'annotations'],
        ['SCR-01', '1 | A\n2 | B'],
      ]);
    });

    it('normalizes CRLF and CR line endings', () => {
      expect(parseCsv('a,b\r\n1,2\r3,4')).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('drops trailing empty rows', () => {
      expect(parseCsv('a,b\n1,2\n\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });
  });

  describe('csvCell', () => {
    it('passes through plain values', () => {
      expect(csvCell('hello')).toBe('hello');
    });
    it('quotes commas, quotes and newlines', () => {
      expect(csvCell('a,b')).toBe('"a,b"');
      expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
      expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    });
    it('renders null/undefined as empty', () => {
      expect(csvCell(null)).toBe('');
      expect(csvCell(undefined)).toBe('');
    });
  });

  describe('round-trip', () => {
    it('parse(toCsv(rows)) === rows for tricky content', () => {
      const rows = [
        ['Screen ID', 'Annotations'],
        ['SCR-01', 'P | Persona — Mr Sharma · §5\n1 | Login — email/password · §6 FR-AUTH-001'],
        ['SCR-02', 'has, comma and "quote"'],
      ];
      expect(parseCsv(toCsv(rows))).toEqual(rows);
    });
  });
});
