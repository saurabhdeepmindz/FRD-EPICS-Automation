import { isPrivateIp, assertPublicUrl, htmlToText, UrlFetchError } from './url-fetch.util';

describe('url-fetch SSRF guard (v11 RR-10)', () => {
  describe('isPrivateIp', () => {
    it('flags loopback / private / link-local / CGNAT IPv4', () => {
      for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.3.4', '172.31.255.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0']) {
        expect(isPrivateIp(ip)).toBe(true);
      }
    });
    it('allows public IPv4', () => {
      for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.10' /* TEST-NET but not in our deny set */]) {
        expect(isPrivateIp(ip)).toBe(false);
      }
    });
    it('flags IPv6 loopback / ULA / link-local / mapped-private', () => {
      for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12::34', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
        expect(isPrivateIp(ip)).toBe(true);
      }
    });
    it('rejects malformed IPv4 (defensive)', () => {
      expect(isPrivateIp('999.1.1.1')).toBe(true);
      expect(isPrivateIp('nonsense')).toBe(true);
    });
  });

  describe('assertPublicUrl', () => {
    it('rejects non-http(s) schemes', async () => {
      await expect(assertPublicUrl('ftp://example.com')).rejects.toBeInstanceOf(UrlFetchError);
      await expect(assertPublicUrl('file:///etc/passwd')).rejects.toBeInstanceOf(UrlFetchError);
    });
    it('rejects literal private/loopback hosts without DNS', async () => {
      await expect(assertPublicUrl('http://127.0.0.1/admin')).rejects.toBeInstanceOf(UrlFetchError);
      await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data')).rejects.toBeInstanceOf(UrlFetchError);
      await expect(assertPublicUrl('http://[::1]:8080')).rejects.toBeInstanceOf(UrlFetchError);
    });
    it('rejects invalid URLs', async () => {
      await expect(assertPublicUrl('not a url')).rejects.toBeInstanceOf(UrlFetchError);
    });
  });

  describe('htmlToText', () => {
    it('strips scripts/styles/markup and decodes entities', () => {
      const html = '<html><head><style>x{}</style></head><body><script>evil()</script><h1>Title</h1><p>Hello&nbsp;&amp; welcome &lt;3</p></body></html>';
      const text = htmlToText(html);
      expect(text).not.toMatch(/evil\(\)/);
      expect(text).not.toMatch(/<script>/);
      expect(text).toContain('Title');
      expect(text).toContain('Hello & welcome <3');
    });
  });
});
