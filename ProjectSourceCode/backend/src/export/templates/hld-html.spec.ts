import { generateHldHtml, type HldHtmlData } from './hld-html';

const base: HldHtmlData = {
  productName: 'Luggage Room',
  version: 3,
  status: 'DRAFT',
  createdAt: '2026-06-07T00:00:00.000Z',
  sections: {},
  mermaidDiagrams: {},
};

describe('generateHldHtml (v10 HE-04)', () => {
  it('renders a full HTML document with cover + TOC for all 17 sections', () => {
    const html = generateHldHtml(base);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('HLD for Luggage Room');
    expect(html).toContain('Table of Contents');
    // a few representative section names from the 17
    expect(html).toContain('Document Control');
    expect(html).toContain('Multi-Tenancy &amp; Data Isolation');
    expect(html).toContain('Project Structure');
  });

  it('renders string/array/object section fields and humanizes keys', () => {
    const html = generateHldHtml({
      ...base,
      sections: {
        multiTenancy: {
          isolationStrategy: 'Row-level security',
          keyDecisions: ['org_id on every table', 'AES-256 at rest'],
          nested: { tenantKey: 'org_id' },
        },
      },
    });
    expect(html).toContain('Isolation Strategy'); // humanized from isolationStrategy
    expect(html).toContain('Row-level security');
    expect(html).toContain('org_id on every table'); // array item
    expect(html).toContain('Tenant Key'); // nested object key humanized
  });

  it('strips the [AI] authoring prefix (export renders in black)', () => {
    const html = generateHldHtml({
      ...base,
      sections: { executiveSummary: { overview: '[AI] A secure marketplace.' } },
    });
    expect(html).toContain('A secure marketplace.');
    expect(html).not.toContain('[AI] A secure marketplace.');
  });

  it('escapes HTML in field values', () => {
    const html = generateHldHtml({
      ...base,
      sections: { systemView: { note: 'use <script>alert(1)</script> & co' } },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; co');
  });

  it('emits a Mermaid block + loader script only when diagrams exist', () => {
    const without = generateHldHtml(base);
    expect(without).not.toContain('class="mermaid"');
    expect(without).not.toContain('mermaid.min.js');

    const withDiag = generateHldHtml({
      ...base,
      mermaidDiagrams: { systemView: 'graph TD; A[Users]-->B[API];' },
    });
    expect(withDiag).toContain('Architecture Diagrams');
    expect(withDiag).toContain('class="mermaid"');
    expect(withDiag).toContain('mermaid.min.js');
    // pastel classDef injection carried into the export source
    expect(withDiag).toContain('classDef');
  });

  it('shows "Not generated." for missing sections', () => {
    const html = generateHldHtml(base); // all sections empty
    expect(html).toContain('Not generated.');
  });
});
