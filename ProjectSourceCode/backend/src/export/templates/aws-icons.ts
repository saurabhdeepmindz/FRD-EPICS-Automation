/**
 * AWS Architecture Icon set (export side) — faithful inline-SVG renditions in the
 * official AWS Architecture Icons STYLE: a rounded-square tile filled with the
 * correct AWS service-family gradient and a clean white glyph. Used by the §7 AWS
 * Deployment View HTML so the icons survive PDF (Puppeteer = full Chromium) and
 * degrade gracefully in DOCX (html-to-docx renders the coloured tile; the glyph
 * may not, so the service name/abbr below the tile always carries the meaning).
 *
 * The AI returns a `family` per service; the renderer maps family → gradient +
 * glyph. Glyphs are per-family (recognisable line-art), which reads as AWS icons
 * while keeping the asset count to zero (no external icon package to bundle).
 */

export type AwsFamily =
  | 'compute'
  | 'containers'
  | 'storage'
  | 'database'
  | 'analytics'
  | 'appIntegration'
  | 'security'
  | 'mlai'
  | 'networking'
  | 'management';

/** AWS service-family → [gradient top, gradient bottom] (official-style hues). */
export const AWS_FAMILY_COLORS: Record<AwsFamily, [string, string]> = {
  compute: ['#F58536', '#E0820A'],
  containers: ['#F58536', '#E0820A'],
  storage: ['#8FC74A', '#669E1E'],
  database: ['#5A86F2', '#2E5FE8'],
  analytics: ['#A06BFF', '#7D3AC1'],
  appIntegration: ['#F25CA2', '#E7157B'],
  security: ['#F0556B', '#DD344C'],
  mlai: ['#2FD4B8', '#01A88D'],
  networking: ['#9E7BFF', '#7D3AC1'],
  management: ['#E84393', '#B0084D'],
};

export const AWS_FAMILY_LABELS: Record<AwsFamily, string> = {
  compute: 'Compute',
  containers: 'Containers / Registry',
  storage: 'Storage',
  database: 'Database',
  analytics: 'Analytics',
  appIntegration: 'Application integration',
  security: 'Security / Identity',
  mlai: 'ML / AI',
  networking: 'Networking / Content delivery',
  management: 'Management / Governance',
};

/** White line-art glyph (24×24 viewBox paths) per family. */
const GLYPHS: Record<AwsFamily, string> = {
  // chip
  compute:
    '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M9.5 4.5v2.5M14.5 4.5v2.5M9.5 17v2.5M14.5 17v2.5M4.5 9.5h2.5M4.5 14.5h2.5M17 9.5h2.5M17 14.5h2.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
  // hexagon container
  containers:
    '<path d="M12 3.8l7 4v8.4l-7 4-7-4V7.8z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 12l7-4M12 12v8.2M12 12L5 8" stroke="#fff" stroke-width="1.3"/>',
  // bucket
  storage:
    '<path d="M5.5 6.5h13l-1.3 12.2a1 1 0 0 1-1 .9H7.8a1 1 0 0 1-1-.9z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="12" cy="6.5" rx="6.5" ry="1.9" fill="none" stroke="#fff" stroke-width="1.5"/>',
  // cylinder (db)
  database:
    '<ellipse cx="12" cy="6.5" rx="6" ry="2.3" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M6 6.5v11c0 1.27 2.69 2.3 6 2.3s6-1.03 6-2.3v-11" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M6 12c0 1.27 2.69 2.3 6 2.3s6-1.03 6-2.3" fill="none" stroke="#fff" stroke-width="1.3"/>',
  // bar chart
  analytics:
    '<path d="M5 19h14" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><rect x="6.5" y="11" width="2.6" height="6" fill="#fff"/><rect x="10.7" y="7.5" width="2.6" height="9.5" fill="#fff"/><rect x="14.9" y="13" width="2.6" height="4" fill="#fff"/>',
  // envelopes / messaging
  appIntegration:
    '<rect x="4.5" y="6.5" width="15" height="11" rx="1.4" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M4.8 7.5l7.2 5.2 7.2-5.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>',
  // shield
  security:
    '<path d="M12 3.8l6.2 2.3v5c0 4.2-2.7 7-6.2 8.6-3.5-1.6-6.2-4.4-6.2-8.6v-5z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.2 12.2l2 2 3.6-3.8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  // spark / AI
  mlai:
    '<circle cx="12" cy="12" r="2.3" fill="#fff"/><circle cx="6" cy="6.5" r="1.5" fill="#fff"/><circle cx="18" cy="7" r="1.5" fill="#fff"/><circle cx="6.5" cy="17.5" r="1.5" fill="#fff"/><circle cx="17.5" cy="17" r="1.5" fill="#fff"/><path d="M10.2 10.4L7 7.2M13.8 10.6L17 7.6M10.4 13.6L7.4 16.4M13.6 13.6L16.6 16.2" stroke="#fff" stroke-width="1.2"/>',
  // globe / network
  networking:
    '<circle cx="12" cy="12" r="7.2" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M4.8 12h14.4M12 4.8c2 2 3 4.6 3 7.2s-1 5.2-3 7.2c-2-2-3-4.6-3-7.2s1-5.2 3-7.2z" fill="none" stroke="#fff" stroke-width="1.3"/>',
  // gear
  management:
    '<circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12 4.6v2.2M12 17.2v2.2M19.4 12h-2.2M6.8 12H4.6M17.2 6.8l-1.6 1.6M8.4 15.6l-1.6 1.6M17.2 17.2l-1.6-1.6M8.4 8.4L6.8 6.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
};

function normFamily(family?: string): AwsFamily {
  const f = (family ?? '').trim() as AwsFamily;
  return f in AWS_FAMILY_COLORS ? f : 'compute';
}

/**
 * An AWS-style service icon as a self-contained inline SVG string of the given
 * pixel size. `idSeed` keeps the gradient id unique per icon in a page.
 */
export function awsIconSvg(family: string | undefined, size = 38, idSeed = 0): string {
  const fam = normFamily(family);
  const [c1, c2] = AWS_FAMILY_COLORS[fam];
  const gid = `awsg-${fam}-${idSeed}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${AWS_FAMILY_LABELS[fam]}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect x="0.5" y="0.5" width="23" height="23" rx="4.5" fill="url(#${gid})"/>
    ${GLYPHS[fam]}
  </svg>`;
}
