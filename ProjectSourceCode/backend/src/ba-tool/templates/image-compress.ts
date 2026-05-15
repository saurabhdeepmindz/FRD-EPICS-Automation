/**
 * Compress base64 screen images before embedding them in HTML for the
 * Puppeteer-driven PDF render path.
 *
 * Why this exists: `BaScreen.fileData` is stored as a full-resolution
 * data URL (~1.5 MB each on a typical Tax Compass module). For an FTC
 * artifact that embeds 60+ per-feature screen tiles plus the 20-screen
 * catalog, the resulting HTML reaches ~120 MB and Chrome runs out of
 * memory in `page.setContent` / `page.pdf`, throwing
 * `TargetCloseError: Protocol error (Runtime.callFunctionOn): Target closed`.
 *
 * `compressScreenDataUri` re-encodes the image as a JPEG ~600 px wide at
 * quality 72 — visually equivalent for catalog-style thumbnails but
 * roughly 30× smaller on disk. The PDF render path then completes in
 * Chrome's default memory budget.
 *
 * Pure no-op when `sharp` is unavailable or the input isn't a data URL.
 * Failures fall through to the original payload — degraded image quality
 * is preferable to an export that 500s.
 */

let sharp: typeof import('sharp') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharp = require('sharp');
} catch {
  sharp = null;
}

export interface CompressScreenOptions {
  maxWidthPx?: number;     // Default: 600
  jpegQuality?: number;    // Default: 72 (visually clean, ~25–60 KB per image)
}

const DATA_URL_RE = /^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/;

/**
 * Re-encode a screen's data URL into a smaller JPEG. Returns the original
 * input unchanged when `sharp` isn't available, the input isn't a
 * data URL, the decode fails, or sharp throws — the renderer never
 * loses an image to a compression hiccup; it just embeds the larger
 * original.
 */
export async function compressScreenDataUri(
  fileData: string,
  opts: CompressScreenOptions = {},
): Promise<string> {
  if (!sharp) return fileData;
  if (!fileData || typeof fileData !== 'string') return fileData;
  const match = DATA_URL_RE.exec(fileData);
  if (!match) return fileData;

  const inputBuffer = Buffer.from(match[2], 'base64');
  if (inputBuffer.length === 0) return fileData;

  const maxWidth = opts.maxWidthPx ?? 600;
  const quality = opts.jpegQuality ?? 72;

  try {
    const out = await sharp(inputBuffer)
      .resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return fileData;
  }
}

/**
 * Compress an array of screens in parallel. Each screen keeps its other
 * fields (id, title, type) — only `fileData` is replaced with the
 * smaller version. Resolves with a fresh array so the caller can swap it
 * into `BaArtifactDoc.module.screens` without mutating the source.
 */
export async function compressScreensForHtml<S extends { fileData: string }>(
  screens: S[],
  opts: CompressScreenOptions = {},
): Promise<S[]> {
  if (!sharp || screens.length === 0) return screens;
  const out = await Promise.all(
    screens.map(async (s) => ({
      ...s,
      fileData: await compressScreenDataUri(s.fileData, opts),
    })),
  );
  return out;
}
