import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UX — Live OpenAPI / Swagger generator for the CUSTOMER'S target application
 * (the API described by the LLD, not the BA Tool's own API).
 *
 * Two granularities:
 *   - Module-level:    one LLD artifact → one spec
 *   - Project-level:   every LLD in a project, aggregated under /{moduleId} prefix
 *
 * Hand-emits OpenAPI 3.0 JSON + YAML with no third-party dependency, then
 * serves Swagger UI via a tiny HTML page that loads swagger-ui-dist from CDN
 * and points at the JSON endpoint.
 *
 * Keeps D2 (contract-test ZIP export) and G3 (deferred BA-Tool API docs) as
 * entirely separate features — this touches no existing code paths.
 */

type Lang = 'python' | 'typescript' | 'javascript' | 'java' | 'unknown';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface DetectedEndpoint {
  method: HttpMethod;
  path: string;              // normalised, e.g., /users/:id
  summary?: string;          // best-effort from adjacent docstring/comment
  sourceFile: string;
  tag: string;               // derived from sourceFile leaf, e.g., "UserController"
}

interface DetectedSchema {
  name: string;              // e.g., "User"
  properties: Array<{ name: string; type: string; optional: boolean }>;
  sourceFile: string;
}

interface BuiltSpec {
  endpoints: DetectedEndpoint[];
  schemas: DetectedSchema[];
  moduleLabel?: string;
}

interface BaArtifactRow {
  id: string;
  artifactId: string;
}

interface BaModuleRow {
  id: string;
  moduleId: string;
  moduleName: string;
}

interface BaProjectRow {
  id: string;
  name: string;
  projectCode: string;
  productName: string | null;
}

@Injectable()
export class BaOpenApiExportService {
  private readonly logger = new Logger(BaOpenApiExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Module-level ───────────────────────────────────────────────────────

  async buildModuleSpec(lldArtifactDbId: string): Promise<{ spec: Record<string, unknown>; filenameStem: string }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: lldArtifactDbId },
      include: {
        pseudoFiles: { orderBy: { path: 'asc' } },
        module: {
          select: {
            id: true, moduleId: true, moduleName: true,
            project: { select: { id: true, name: true, projectCode: true, productName: true } },
          },
        },
      },
    });
    if (!artifact) throw new NotFoundException(`LLD artifact ${lldArtifactDbId} not found`);
    if (artifact.artifactType !== 'LLD') {
      throw new NotFoundException(`Artifact ${lldArtifactDbId} is not an LLD`);
    }

    const built = this.extractFromArtifact(artifact);
    const spec = this.assembleSpec({
      title: this.title(artifact.module.project, artifact.module),
      version: artifact.module.project.projectCode,
      description: this.moduleDescription(artifact.module.project, artifact.module, artifact),
      endpoints: built.endpoints,
      schemas: built.schemas,
    });
    return { spec, filenameStem: `${artifact.artifactId}-openapi` };
  }

  // ─── Project-level (aggregated) ─────────────────────────────────────────

  async buildProjectSpec(projectId: string): Promise<{ spec: Record<string, unknown>; filenameStem: string }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, projectCode: true, productName: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const lldArtifacts = await this.prisma.baArtifact.findMany({
      where: { artifactType: 'LLD', module: { projectId } },
      include: {
        pseudoFiles: { orderBy: { path: 'asc' } },
        module: { select: { id: true, moduleId: true, moduleName: true } },
      },
      orderBy: { artifactId: 'asc' },
    });

    // Merge all module specs; paths get prefixed with `/{moduleId}` to avoid
    // collisions when two modules legitimately implement the same endpoint
    // (e.g. /auth/login in both the admin and tenant-app modules).
    const allEndpoints: DetectedEndpoint[] = [];
    const allSchemas: DetectedSchema[] = [];
    const schemaNameSeen = new Set<string>();

    for (const a of lldArtifacts) {
      const built = this.extractFromArtifact(a);
      const prefix = `/${a.module.moduleId.toLowerCase()}`;
      for (const ep of built.endpoints) {
        allEndpoints.push({
          ...ep,
          path: `${prefix}${ep.path}`,
          tag: `${a.module.moduleId} · ${ep.tag}`,
        });
      }
      for (const sc of built.schemas) {
        // Namespace-prefix schemas too so two modules each with a `User`
        // schema stay distinct. First definition wins; duplicates dropped.
        const namespaced = `${a.module.moduleId}_${sc.name}`;
        if (schemaNameSeen.has(namespaced)) continue;
        schemaNameSeen.add(namespaced);
        allSchemas.push({ ...sc, name: namespaced });
      }
    }

    const spec = this.assembleSpec({
      title: this.projectTitle(project),
      version: project.projectCode,
      description: this.projectDescription(project, lldArtifacts.length),
      endpoints: allEndpoints,
      schemas: allSchemas,
    });
    return { spec, filenameStem: `${project.projectCode}-openapi` };
  }

  // ─── YAML serialisation (hand-rolled, no dep) ───────────────────────────

  toYaml(spec: Record<string, unknown>): string {
    return this.yamlOf(spec, 0);
  }

  private yamlOf(v: unknown, indent: number): string {
    const pad = '  '.repeat(indent);
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return this.yamlScalar(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      return '\n' + v.map((item) => `${pad}- ${this.yamlOfInline(item, indent + 1)}`).join('\n');
    }
    if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length === 0) return '{}';
      return '\n' + entries.map(([k, val]) => `${pad}${k}: ${this.yamlOfInline(val, indent + 1)}`).join('\n');
    }
    return String(v);
  }

  private yamlOfInline(v: unknown, indent: number): string {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return this.yamlScalar(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v) || typeof v === 'object') return this.yamlOf(v, indent);
    return String(v);
  }

  private yamlScalar(s: string): string {
    // Quote anything that looks like it might confuse YAML parsers.
    if (s === '') return '""';
    if (/[:\-#&*!%@`\[\]\{\},\n]|^\s|\s$|^(true|false|null|yes|no|on|off)$/i.test(s)) {
      return JSON.stringify(s);
    }
    return s;
  }

  // ─── Swagger UI HTML (CDN, no dep) ──────────────────────────────────────

  /**
   * Returns a tiny HTML page that loads Swagger UI from a CDN and points at
   * the JSON spec URL relative to the current host. Avoids pulling in the
   * swagger-ui-express middleware and its oddities.
   */
  swaggerUiHtml(specUrl: string, pageTitle: string): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${this.htmlEscape(pageTitle)} — Swagger UI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>
      body { margin: 0; }
      .ba-tool-banner {
        background: #0f172a; color: #e2e8f0; padding: 8px 16px; font: 12px/1.4 system-ui, sans-serif;
        display: flex; justify-content: space-between; align-items: center;
      }
      .ba-tool-banner a { color: #93c5fd; text-decoration: none; }
      .ba-tool-banner a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="ba-tool-banner">
      <span>Auto-generated from LLD pseudo-code · BA Tool</span>
      <span><a href="${this.htmlEscape(specUrl)}" target="_blank" rel="noopener">Raw JSON ↗</a></span>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.addEventListener('load', () => {
        window.ui = SwaggerUIBundle({
          url: ${JSON.stringify(specUrl)},
          dom_id: '#swagger-ui',
          deepLinking: true,
          docExpansion: 'list',
          tryItOutEnabled: false, // servers block is empty by design — disable Try-it-out
        });
      });
    </script>
  </body>
</html>`;
  }

  private htmlEscape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Spec assembly ──────────────────────────────────────────────────────

  private assembleSpec(args: {
    title: string;
    version: string;
    description: string;
    endpoints: DetectedEndpoint[];
    schemas: DetectedSchema[];
  }): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const ep of args.endpoints) {
      paths[ep.path] ??= {};
      const op: Record<string, unknown> = {
        tags: [ep.tag],
        summary: ep.summary ?? `${ep.method} ${ep.path}`,
        'x-source-file': ep.sourceFile,
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': { schema: { type: 'object', additionalProperties: true } },
            },
          },
        },
      };
      // Path parameters (e.g., /users/:id → param `id`)
      const params = [...ep.path.matchAll(/:([a-zA-Z_]\w*)/g)].map((m) => m[1]);
      if (params.length > 0) {
        op.parameters = params.map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        }));
      }
      paths[ep.path][ep.method.toLowerCase()] = op;
    }
    // Normalise path: OpenAPI uses `{id}` not `:id`.
    const openapiPaths: Record<string, Record<string, unknown>> = {};
    for (const [p, ops] of Object.entries(paths)) {
      openapiPaths[p.replace(/:([a-zA-Z_]\w*)/g, '{$1}')] = ops;
    }

    const componentsSchemas: Record<string, unknown> = {};
    for (const sc of args.schemas) {
      const props: Record<string, unknown> = {};
      const required: string[] = [];
      for (const p of sc.properties) {
        props[p.name] = { type: this.openapiType(p.type) };
        if (!p.optional) required.push(p.name);
      }
      componentsSchemas[sc.name] = {
        type: 'object',
        'x-source-file': sc.sourceFile,
        ...(required.length > 0 ? { required } : {}),
        properties: props,
      };
    }

    return {
      openapi: '3.0.3',
      info: {
        title: args.title,
        version: args.version,
        description: args.description,
      },
      // Empty by design — BA Tool can't know the customer's deploy URL. The
      // "editable note" the user asked for lives inside servers[0].description.
      servers: [
        {
          url: 'https://api.example.com',
          description: 'Placeholder — edit to point at your staging/prod deployment.',
        },
      ],
      tags: this.buildTagList(args.endpoints),
      paths: openapiPaths,
      components: {
        schemas: componentsSchemas,
      },
    };
  }

  private buildTagList(endpoints: DetectedEndpoint[]): Array<{ name: string; description?: string }> {
    const seen = new Set<string>();
    const out: Array<{ name: string; description?: string }> = [];
    for (const ep of endpoints) {
      if (seen.has(ep.tag)) continue;
      seen.add(ep.tag);
      out.push({ name: ep.tag });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  private openapiType(raw: string): string {
    const t = raw.toLowerCase().trim();
    if (/(^|\b)(int|integer|long|short|number\b)/.test(t)) return 'integer';
    if (/(^|\b)(float|double|decimal|number)/.test(t)) return 'number';
    if (/(^|\b)(bool|boolean)/.test(t)) return 'boolean';
    if (/(^|\b)(\[\]|array|list<)/.test(t)) return 'array';
    if (/(^|\b)(object|record|map<|dict)/.test(t)) return 'object';
    return 'string';
  }

  // ─── Title helpers ──────────────────────────────────────────────────────

  private title(project: BaProjectRow, module: BaModuleRow): string {
    const base = project.productName?.trim() || project.name;
    return `${base} — ${module.moduleName} API`;
  }

  private projectTitle(project: BaProjectRow): string {
    const base = project.productName?.trim() || project.name;
    return `${base} API`;
  }

  private moduleDescription(project: BaProjectRow, module: BaModuleRow, artifact: BaArtifactRow): string {
    return [
      `Auto-generated OpenAPI 3.0 contract derived from LLD pseudo-code.`,
      `Module: **${module.moduleId} — ${module.moduleName}**`,
      `Artifact: **${artifact.artifactId}**`,
      `Project: **${project.projectCode}**`,
      '',
      `The server URL above is a placeholder — edit it (or add more entries)`,
      `to reflect your staging/production deployments before wiring clients.`,
    ].join('\n');
  }

  private projectDescription(project: BaProjectRow, moduleCount: number): string {
    return [
      `Auto-generated OpenAPI 3.0 contract aggregated across **${moduleCount} module(s)**.`,
      `Module endpoints are prefixed with their \`moduleId\` (e.g. \`/mod-01/users/{id}\`)`,
      `so that modules that legitimately expose the same route don't collide.`,
      '',
      `Project: **${project.projectCode}** · ${project.name}`,
      '',
      `The server URL above is a placeholder — edit it (or add more entries)`,
      `to reflect your staging/production deployments before wiring clients.`,
    ].join('\n');
  }

  // ─── Extraction (endpoints + schemas) ───────────────────────────────────

  private extractFromArtifact(artifact: {
    pseudoFiles: Array<{ path: string; language: string; aiContent: string; editedContent: string | null }>;
    module: BaModuleRow;
  }): BuiltSpec {
    const endpoints: DetectedEndpoint[] = [];
    const schemas: DetectedSchema[] = [];

    for (const pf of artifact.pseudoFiles) {
      const content = pf.editedContent || pf.aiContent || '';
      const lang = this.detectLanguage(pf.path, pf.language);
      if (lang === 'unknown') continue;
      endpoints.push(...this.extractEndpoints(content, pf.path, lang));
      schemas.push(...this.extractSchemas(content, pf.path, lang));
    }

    return { endpoints, schemas };
  }

  private detectLanguage(path: string, declared: string | null): Lang {
    const lower = (declared ?? '').toLowerCase();
    if (lower.includes('python')) return 'python';
    if (lower.includes('typescript') || lower === 'ts') return 'typescript';
    if (lower.includes('javascript') || lower === 'js') return 'javascript';
    if (lower.includes('java') && !lower.includes('script')) return 'java';
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (['py'].includes(ext)) return 'python';
    if (['ts', 'tsx'].includes(ext)) return 'typescript';
    if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
    if (['java'].includes(ext)) return 'java';
    return 'unknown';
  }

  private extractEndpoints(content: string, sourceFile: string, lang: Lang): DetectedEndpoint[] {
    const out: DetectedEndpoint[] = [];
    const tag = this.tagForFile(sourceFile);

    const push = (method: HttpMethod, path: string, summary?: string) => {
      if (!path) return;
      const normalised = path
        .replace(/\{([^}]+)\}/g, ':$1')
        .replace(/\/+$/, '')
        .replace(/^([^/])/, '/$1')
        .trim();
      out.push({ method, path: normalised, summary, sourceFile, tag });
    };

    if (lang === 'typescript' || lang === 'javascript') {
      const appCall = /(?:app|router|fastify|server)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let m;
      while ((m = appCall.exec(content)) !== null) {
        push(m[1].toUpperCase() as HttpMethod, m[2]);
      }
      const nestDecorator = /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/g;
      while ((m = nestDecorator.exec(content)) !== null) {
        push(m[1].toUpperCase() as HttpMethod, m[2] || '/');
      }
    } else if (lang === 'python') {
      const fastApi = /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi;
      let m;
      while ((m = fastApi.exec(content)) !== null) {
        push(m[1].toUpperCase() as HttpMethod, m[2]);
      }
      const flaskRoute = /@app\.route\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*methods\s*=\s*\[['"](\w+)['"]\])?/gi;
      while ((m = flaskRoute.exec(content)) !== null) {
        push((m[2]?.toUpperCase() as HttpMethod) || 'GET', m[1]);
      }
    } else if (lang === 'java') {
      const mapping = /@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/g;
      let m;
      while ((m = mapping.exec(content)) !== null) {
        push(m[1].toUpperCase() as HttpMethod, m[2]);
      }
    }

    return out;
  }

  private extractSchemas(content: string, sourceFile: string, lang: Lang): DetectedSchema[] {
    const out: DetectedSchema[] = [];

    if (lang === 'typescript') {
      // interface Foo { a: string; b?: number }
      const ifaceRe = /(?:export\s+)?interface\s+([A-Z][\w$]*)\s*\{([^}]*)\}/gs;
      let m;
      while ((m = ifaceRe.exec(content)) !== null) {
        const props = this.parseTsBody(m[2]);
        if (props.length > 0) out.push({ name: m[1], properties: props, sourceFile });
      }
      // class Foo { a: string; b?: number }
      const classRe = /(?:export\s+)?class\s+([A-Z][\w$]*)[^{]*\{([^}]*)\}/gs;
      while ((m = classRe.exec(content)) !== null) {
        const props = this.parseTsBody(m[2]);
        if (props.length > 0) out.push({ name: m[1], properties: props, sourceFile });
      }
    } else if (lang === 'python') {
      // class Foo(BaseModel):  a: str   b: int | None = None
      const classRe = /class\s+([A-Z]\w*)\s*(?:\([^)]*\))?\s*:\s*([\s\S]*?)(?=^class\s|\Z)/gm;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const props = this.parsePythonBody(m[2]);
        if (props.length > 0) out.push({ name: m[1], properties: props, sourceFile });
      }
    } else if (lang === 'java') {
      // class Foo { private String a; private Integer b; }
      const classRe = /class\s+([A-Z]\w*)[^{]*\{([\s\S]*?)\}/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const props = this.parseJavaBody(m[2]);
        if (props.length > 0) out.push({ name: m[1], properties: props, sourceFile });
      }
    }

    return out;
  }

  private parseTsBody(body: string): Array<{ name: string; type: string; optional: boolean }> {
    const out: Array<{ name: string; type: string; optional: boolean }> = [];
    const lineRe = /^\s*(?:public\s+|private\s+|readonly\s+)*([a-zA-Z_$][\w$]*)(\?)?\s*:\s*([^;,\n]+)[;,]?$/gm;
    let m;
    while ((m = lineRe.exec(body)) !== null) {
      out.push({ name: m[1], type: m[3].trim(), optional: !!m[2] });
    }
    return out;
  }

  private parsePythonBody(body: string): Array<{ name: string; type: string; optional: boolean }> {
    const out: Array<{ name: string; type: string; optional: boolean }> = [];
    const lineRe = /^\s{0,8}([a-zA-Z_]\w*)\s*:\s*([A-Za-z_][\w\[\], |.]*?)(?:\s*=\s*([^#\n]+))?\s*$/gm;
    let m;
    while ((m = lineRe.exec(body)) !== null) {
      const name = m[1];
      if (name.startsWith('_') || name === 'self' || name === 'cls') continue;
      const rawType = m[2].trim();
      const isOptional = /\bOptional\[|\|\s*None\b|=\s*None\b/.test(`${rawType}${m[3] ?? ''}`) || m[3] !== undefined;
      out.push({ name, type: rawType, optional: isOptional });
    }
    return out;
  }

  private parseJavaBody(body: string): Array<{ name: string; type: string; optional: boolean }> {
    const out: Array<{ name: string; type: string; optional: boolean }> = [];
    const lineRe = /^\s*(?:public|private|protected)\s+(?:static\s+|final\s+)*([A-Za-z_][\w<>,\s]*?)\s+([a-zA-Z_]\w*)\s*[;=]/gm;
    let m;
    while ((m = lineRe.exec(body)) !== null) {
      out.push({ name: m[2], type: m[1].trim(), optional: false });
    }
    return out;
  }

  private tagForFile(sourcePath: string): string {
    const leaf = sourcePath.split('/').pop() ?? sourcePath;
    return leaf.replace(/\.(py|tsx?|jsx?|java|mjs|cjs)$/i, '') || sourcePath;
  }
}
