import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { DesignSystemService } from './design-system.service';
import { tokensToCss, moduleColor, type DesignTokens } from './design-tokens';

/**
 * Wireframe Navigator (Sprint v9 · Track DD). Deterministically stitches a
 * project's PIPELINE wireframes into a single `index.html` — modules → screens —
 * styled with the project's Design System tokens. Mirrors the user's reference
 * navigator: sidebar (module groups + counts + search), hero stats, per-module
 * screen-card grids linking each screen file, uploaded badges. Also writes the
 * navigator + every screen to disk and packages a downloadable zip.
 */

type Kind = 'lofi' | 'hifi';

interface NavScreen {
  slug: string;
  title: string;
  htmlContent: string | null;
  uploaded: boolean;
  moduleKey: string;
  moduleLabel: string;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Module key from a §6 FR-ID, e.g. "FR-AUTH-001" → "AUTH". */
function moduleKeyFromFr(fr: string): string | null {
  const m = /^FR-([A-Za-z0-9]+)-/.exec(fr.trim());
  return m ? m[1].toUpperCase() : null;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

@Injectable()
export class WireframeNavigatorService {
  private readonly logger = new Logger(WireframeNavigatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
    private readonly designSystem: DesignSystemService,
  ) {}

  /** Build the navigator HTML for the latest PIPELINE set of the given kind. */
  async buildHtml(projectId: string, kind: Kind): Promise<string> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const tokens = await this.designSystem.resolveTokens(projectId);
    const logo = (await this.designSystem.getActive(projectId))?.logo as { dataUri?: string } | null;
    const screens = await this.collectScreens(projectId, kind);
    return this.render(project.name, kind, screens, tokens, logo ?? null);
  }

  /** Write index.html + every screen file + shared CSS to the artifact folder. */
  async writeToDisk(projectId: string, kind: Kind): Promise<void> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) return;
    const sub = kind === 'hifi' ? '04-Wireframes-HiFi' : '03-Wireframes-LoFi';
    const screens = await this.collectScreens(projectId, kind);
    if (!screens.length) return;
    const html = await this.buildHtml(projectId, kind);
    await this.projectFolders.writeArtifactFile(project.name, sub, 'index.html', html).catch((e) => this.logger.warn(`navigator write failed: ${e}`));
    for (const s of screens) {
      await this.projectFolders
        .writeArtifactFile(project.name, sub, `${s.slug}.html`, s.htmlContent ?? '')
        .catch(() => undefined);
    }
    this.logger.log(`Navigator written: ${sub}/index.html + ${screens.length} screens (${project.name})`);
  }

  /** Zip of index.html + all screen files for download. */
  async buildZip(projectId: string, kind: Kind): Promise<{ fileName: string; buffer: Buffer }> {
    const screens = await this.collectScreens(projectId, kind);
    const html = await this.buildHtml(projectId, kind);
    const zip = new AdmZip();
    zip.addFile('index.html', Buffer.from(html, 'utf-8'));
    for (const s of screens) {
      zip.addFile(`${s.slug}.html`, Buffer.from(s.htmlContent ?? '', 'utf-8'));
    }
    return { fileName: `wireframes-${kind}.zip`, buffer: zip.toBuffer() };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async collectScreens(projectId: string, kind: Kind): Promise<NavScreen[]> {
    const lofiSet = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!lofiSet) return [];

    let rows: { slug: string; title: string; htmlContent: string | null; meta: unknown }[];
    if (kind === 'hifi') {
      const hifiSet = await this.prisma.baHifiSet.findFirst({
        where: { projectId, wireframeSetId: lofiSet.id },
        orderBy: { createdAt: 'desc' },
        include: { screens: { orderBy: { sequenceNum: 'asc' } } },
      });
      rows = (hifiSet?.screens ?? []).map((s) => ({ slug: s.slug, title: s.title, htmlContent: s.htmlContent, meta: s.meta }));
    } else {
      rows = lofiSet.screens.map((s) => ({ slug: s.slug, title: s.title, htmlContent: s.htmlContent, meta: s.meta }));
    }

    return rows.map((s) => {
      const meta = (s.meta as { frRefs?: string[]; uploaded?: boolean } | null) ?? {};
      const key = (meta.frRefs ?? []).map(moduleKeyFromFr).find(Boolean) ?? (meta.uploaded ? 'UPLOADED' : 'GENERAL');
      return {
        slug: s.slug,
        title: s.title,
        htmlContent: s.htmlContent,
        uploaded: !!meta.uploaded,
        moduleKey: key as string,
        moduleLabel: key === 'UPLOADED' ? 'Uploaded' : key === 'GENERAL' ? 'General' : titleCase(key as string),
      };
    });
  }

  private render(projectName: string, kind: Kind, screens: NavScreen[], tokens: DesignTokens, logo: { dataUri?: string } | null): string {
    // Group by module, preserving first-seen order.
    const order: string[] = [];
    const byModule = new Map<string, NavScreen[]>();
    for (const s of screens) {
      if (!byModule.has(s.moduleKey)) { byModule.set(s.moduleKey, []); order.push(s.moduleKey); }
      byModule.get(s.moduleKey)!.push(s);
    }

    const logoMark = logo?.dataUri
      ? `<img src="${esc(logo.dataUri)}" alt="logo" style="width:30px;height:30px;border-radius:8px;object-fit:contain">`
      : `<div class="mk">${esc((projectName || 'A').charAt(0).toUpperCase())}</div>`;

    const sidebarNodes = order
      .map((key, i) => {
        const list = byModule.get(key)!;
        const color = moduleColor(tokens, key, i);
        return `<label class="sb-node" data-mod="${esc(key)}"><span class="dot" style="background:${color}"></span><span class="name">${esc(list[0].moduleLabel)}</span><span class="ct">${list.length}</span></label>`;
      })
      .join('\n');

    const sections = order
      .map((key, i) => {
        const list = byModule.get(key)!;
        const color = moduleColor(tokens, key, i);
        const cards = list
          .map(
            (s) => `<a class="card" href="${esc(s.slug)}.html" target="_blank" rel="noopener">
  <div class="thumb"><iframe src="${esc(s.slug)}.html" scrolling="no" tabindex="-1"></iframe>${s.uploaded ? '<span class="up">uploaded</span>' : ''}</div>
  <div class="cb"><div class="ct-name">${esc(s.title)}</div><div class="ct-slug">${esc(s.slug)}</div></div>
</a>`,
          )
          .join('\n');
        return `<section class="sec" data-mod="${esc(key)}">
  <div class="sec-head"><span class="tag" style="background:${color}">${esc(list[0].moduleLabel)}</span><h2>${esc(list[0].moduleLabel)}</h2><span class="cnt">${list.length} screen${list.length === 1 ? '' : 's'}</span></div>
  <div class="grid">${cards}</div>
</section>`;
      })
      .join('\n');

    const css = tokensToCss(tokens);
    const kindLabel = kind === 'hifi' ? 'Hi-fi' : 'Lo-fi';

    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(projectName)} · ${kindLabel} Wireframe Navigator</title>
<meta name="viewport" content="width=1200">
<style>${css}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--ui-font);background:var(--bg-page);color:var(--text-primary)}
.shell{display:grid;grid-template-columns:280px 1fr;min-height:100vh}
.sidebar{background:var(--brand-primary);color:#fff;position:sticky;top:0;height:100vh;overflow-y:auto;padding:18px 0}
.sb-brand{display:flex;align-items:center;gap:9px;padding:0 18px 14px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:12px}
.sb-brand .mk{width:30px;height:30px;border-radius:8px;background:var(--brand-cta);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
.sb-brand b{font-size:13px}.sb-brand .sub{font-size:10.5px;color:rgba(255,255,255,.5)}
.sb-search{padding:0 14px 10px}
.sb-search input{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;padding:7px 10px;font:inherit;font-size:.78rem;outline:none}
.sb-search input::placeholder{color:rgba(255,255,255,.4)}
.sb-node{display:flex;align-items:center;gap:9px;padding:8px 18px;cursor:pointer;font-size:.8rem;color:rgba(255,255,255,.8);border-left:3px solid transparent}
.sb-node:hover{background:rgba(255,255,255,.05);color:#fff}
.sb-node.on{background:rgba(255,255,255,.08);border-left-color:var(--brand-cta);color:#fff}
.sb-node .dot{width:9px;height:9px;border-radius:50%}
.sb-node .name{flex:1;font-weight:600}
.sb-node .ct{font-size:.62rem;background:rgba(255,255,255,.1);padding:1px 7px;border-radius:var(--radius-pill)}
.main{padding:24px 28px 60px}
.hero{background:linear-gradient(135deg,var(--brand-primary),#1e3a5f);color:#fff;border-radius:var(--radius-card);padding:28px 32px;margin-bottom:24px}
.hero .ey{font-size:11px;font-weight:var(--weight-bold);letter-spacing:1.5px;color:var(--brand-cta);text-transform:uppercase}
.hero h1{font-size:26px;margin:10px 0}
.hero .stats{display:flex;gap:28px;margin-top:14px}
.hero .stat .n{font-size:22px;font-weight:800;color:var(--brand-cta)}
.hero .stat .l{font-size:12px;color:rgba(255,255,255,.65)}
.sec{margin-bottom:34px}
.sec-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid var(--brand-primary);padding-bottom:10px;margin-bottom:14px}
.sec-head .tag{font-size:.65rem;font-weight:800;color:#fff;padding:3px 9px;border-radius:5px;text-transform:uppercase}
.sec-head h2{font-size:1.05rem;color:var(--brand-primary)}
.sec-head .cnt{margin-left:auto;font-size:.72rem;color:var(--text-muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.card{background:var(--brand-surface);border:1px solid var(--border);border-radius:var(--radius-card);overflow:hidden;text-decoration:none;color:var(--text-primary);box-shadow:var(--elevation);transition:transform .12s,box-shadow .12s}
.card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.12)}
.thumb{height:170px;overflow:hidden;position:relative;background:var(--bg-soft);border-bottom:1px solid var(--border)}
.thumb iframe{width:250%;height:425px;border:0;transform:scale(.4);transform-origin:top left;pointer-events:none}
.thumb .up{position:absolute;top:8px;right:8px;font-size:10px;font-weight:700;background:var(--info);color:#fff;padding:2px 7px;border-radius:5px}
.cb{padding:10px 12px}
.ct-name{font-size:.86rem;font-weight:var(--weight-bold)}
.ct-slug{font-size:.66rem;color:var(--text-subtle);font-family:var(--mono-font);margin-top:2px}
.sec[hidden]{display:none}
.empty{padding:60px;text-align:center;color:var(--text-muted)}
</style></head><body>
<div class="shell">
  <aside class="sidebar">
    <div class="sb-brand">${logoMark}<div><b>${esc(projectName)}</b><div class="sub">${kindLabel} · ${screens.length} screens</div></div></div>
    <div class="sb-search"><input id="q" type="text" placeholder="Filter screens…"></div>
    <label class="sb-node on" data-mod="__all"><span class="dot" style="background:var(--brand-cta)"></span><span class="name">All modules</span><span class="ct">${order.length}</span></label>
    ${sidebarNodes}
  </aside>
  <main class="main">
    <div class="hero">
      <div class="ey">${kindLabel} Wireframe Navigator</div>
      <h1>${esc(projectName)} — all modules &amp; screens</h1>
      <div class="stats">
        <div class="stat"><div class="n">${screens.length}</div><div class="l">Screens</div></div>
        <div class="stat"><div class="n">${order.length}</div><div class="l">Modules</div></div>
        <div class="stat"><div class="n">${screens.filter((s) => s.uploaded).length}</div><div class="l">Uploaded</div></div>
      </div>
    </div>
    ${sections || '<div class="empty">No wireframes yet — generate lo-fi/hi-fi first.</div>'}
  </main>
</div>
<script>
(function(){
  var nodes=[].slice.call(document.querySelectorAll('.sb-node'));
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  function filterMod(mod){
    nodes.forEach(function(n){n.classList.toggle('on',n.dataset.mod===mod);});
    secs.forEach(function(s){s.hidden = !(mod==='__all'||s.dataset.mod===mod);});
  }
  nodes.forEach(function(n){n.addEventListener('click',function(){filterMod(n.dataset.mod);});});
  document.getElementById('q').addEventListener('input',function(e){
    var q=e.target.value.toLowerCase();
    secs.forEach(function(s){
      var cards=[].slice.call(s.querySelectorAll('.card'));var any=false;
      cards.forEach(function(c){var hit=c.textContent.toLowerCase().indexOf(q)>-1;c.style.display=hit?'':'none';if(hit)any=true;});
      s.hidden=!any;
    });
  });
})();
</script>
</body></html>`;
  }
}
