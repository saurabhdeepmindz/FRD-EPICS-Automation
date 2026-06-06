import { lookup } from 'node:dns/promises';
import axios from 'axios';

/**
 * SSRF-guarded URL fetch + HTML→text extraction (Sprint v11 / Track RR, RR-03/RR-10).
 *
 * Security: only http(s); the hostname is DNS-resolved and every candidate IP is
 * checked against loopback/private/link-local/CGNAT/metadata ranges; redirects are
 * followed manually so EACH hop is re-validated; response size + time are capped.
 */

const MAX_BYTES = 3_000_000; // 3 MB
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export class UrlFetchError extends Error {}

/** True if an IP literal is loopback / private / link-local / CGNAT / metadata. */
export function isPrivateIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase();

  // IPv6
  if (addr.includes(':')) {
    if (addr === '::1' || addr === '::') return true; // loopback / unspecified
    if (addr.startsWith('fe80') || addr.startsWith('fc') || addr.startsWith('fd')) return true; // link-local / ULA
    // IPv4-mapped (::ffff:a.b.c.d)
    const m = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIp(m[1]);
    return false;
  }

  // IPv4
  const parts = addr.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → reject
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/** Validate scheme + that no resolved IP for the host is private. Throws on violation. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new UrlFetchError('Invalid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new UrlFetchError('Only http(s) URLs are allowed.');
  }
  // A bare IP host is checked directly; a name is resolved to all its IPs.
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let ips: string[];
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    ips = [host];
  } else {
    try {
      const records = await lookup(host, { all: true });
      ips = records.map((r) => r.address);
    } catch {
      throw new UrlFetchError(`Could not resolve host "${host}".`);
    }
  }
  if (!ips.length || ips.some(isPrivateIp)) {
    throw new UrlFetchError('Refusing to fetch a private, loopback, or internal address.');
  }
  return u;
}

export interface FetchedPage {
  finalUrl: string;
  title: string;
  text: string;
}

/** Fetch a public web page (manual, per-hop-validated redirects) and extract readable text. */
export async function fetchReadablePage(rawUrl: string): Promise<FetchedPage> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = await assertPublicUrl(current);
    const res = await axios.get<string>(u.toString(), {
      timeout: TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      responseType: 'text',
      transformResponse: (d) => d, // keep raw HTML
      validateStatus: (s) => s < 400 || (s >= 300 && s < 400),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FRD-EPICS-HLD-Copilot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers['location'];
      if (!loc) throw new UrlFetchError('Redirect without a location.');
      current = new URL(loc, u).toString(); // resolve relative redirects, re-validated next loop
      continue;
    }
    const ct = String(res.headers['content-type'] ?? '');
    if (ct && !ct.includes('html') && !ct.includes('text') && !ct.includes('xml')) {
      throw new UrlFetchError(`Unsupported content type "${ct}". Add it as a document instead.`);
    }
    const html = typeof res.data === 'string' ? res.data : String(res.data ?? '');
    return { finalUrl: u.toString(), title: extractTitle(html) || u.hostname, text: htmlToText(html) };
  }
  throw new UrlFetchError('Too many redirects.');
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim().slice(0, 200) : '';
}

/** Dependency-free HTML → readable text (strips scripts/styles/markup; the LLM tolerates noise). */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|head|nav|footer|form)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|br|header)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\r]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return s.slice(0, 60_000);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
