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
  /** When detected as an enum, these literal values appear in the OpenAPI `enum` array. */
  enumValues?: string[];
  /** When detected as an enum, this is the primitive type (`string` / `integer`). */
  enumBaseType?: 'string' | 'integer';
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

    // Build the schema name set FIRST so field-level type resolution can emit
    // `$ref` to peer schemas instead of losing them as `type: string`.
    const knownSchemaNames = new Set(args.schemas.map((s) => s.name));

    const componentsSchemas: Record<string, unknown> = {};
    for (const sc of args.schemas) {
      // Enum schemas render as `{ type: string, enum: [...] }` rather than as
      // an object with properties. This prevents Swagger UI from showing a
      // fake `Values` property (the Python enum value line got mis-parsed as
      // a field earlier).
      if (sc.enumValues && sc.enumValues.length > 0) {
        componentsSchemas[sc.name] = {
          type: sc.enumBaseType ?? 'string',
          enum: sc.enumValues,
          'x-source-file': sc.sourceFile,
        };
        continue;
      }

      // Skip schemas with no parseable properties — emitting them as
      // `{ type: object, properties: {} }` just confuses readers. Leave a
      // comment-via-description so the reader knows extraction found the
      // class name but couldn't read its body (often type aliases, empty
      // interfaces, or unusual syntax the regex-grade parser missed).
      if (sc.properties.length === 0) {
        componentsSchemas[sc.name] = {
          type: 'object',
          additionalProperties: true,
          description: `No properties were parsed from \`${sc.sourceFile}\`. The class was detected by name; its shape is unspecified. Edit the pseudo-code or hand-complete this schema.`,
          'x-source-file': sc.sourceFile,
        };
        continue;
      }

      const props: Record<string, unknown> = {};
      const required: string[] = [];
      for (const p of sc.properties) {
        const schema = this.openapiSchemaFor(p.type, knownSchemaNames);
        props[p.name] = schema;
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

  /**
   * Map a pseudo-code type expression to an OpenAPI schema. Handles:
   *   - primitives (int, string, bool, etc.)
   *   - arrays:  `List[User]`, `User[]`, `Array<User>`, `list[User]`
   *   - maps:    `dict`, `Map<K, V>`, `Record<string, User>`
   *   - nullable: `Optional[User]`, `User?`, `User | None`, `User | null`
   *   - refs:    when the inner type name matches a known schema, emit `$ref`
   */
  private openapiSchemaFor(raw: string, knownSchemas: Set<string>): Record<string, unknown> {
    const cleaned = this.stripNullable(raw).trim();

    // Array containers
    const arrayInner = this.unwrapArray(cleaned);
    if (arrayInner !== null) {
      return { type: 'array', items: this.openapiSchemaFor(arrayInner, knownSchemas) };
    }

    // Map / Record / dict containers — OpenAPI models these as objects with
    // additionalProperties pointing at the value schema.
    const mapValue = this.unwrapMap(cleaned);
    if (mapValue !== null) {
      return { type: 'object', additionalProperties: this.openapiSchemaFor(mapValue, knownSchemas) };
    }

    const lower = cleaned.toLowerCase();

    // Primitives
    if (/^(int|integer|long|short|i32|i64)$/.test(lower)) return { type: 'integer' };
    if (/^(float|double|decimal|number|real)$/.test(lower)) return { type: 'number' };
    if (/^(bool|boolean)$/.test(lower)) return { type: 'boolean' };
    if (/^(string|str|char|text|uuid|email|date|datetime|time|timestamp|url|uri)$/.test(lower)) {
      if (/^(date)$/.test(lower)) return { type: 'string', format: 'date' };
      if (/^(datetime|timestamp)$/.test(lower)) return { type: 'string', format: 'date-time' };
      if (lower === 'uuid') return { type: 'string', format: 'uuid' };
      if (lower === 'email') return { type: 'string', format: 'email' };
      if (lower === 'url' || lower === 'uri') return { type: 'string', format: 'uri' };
      return { type: 'string' };
    }
    if (/^(any|object|json)$/.test(lower)) {
      return { type: 'object', additionalProperties: true };
    }

    // Reference to a known schema (module-level schemas use plain names;
    // project-level schemas are prefixed with the module id). Check both.
    const refName = this.matchKnownSchema(cleaned, knownSchemas);
    if (refName) {
      return { $ref: `#/components/schemas/${refName}` };
    }

    // Unknown type — render as string so Swagger UI still renders a sensible
    // cell, but preserve the raw type for humans via description.
    return { type: 'string', description: `Pseudo-code type: \`${cleaned}\`` };
  }

  private stripNullable(raw: string): string {
    // Python: `Optional[X]`  `X | None`  `Union[X, None]`
    // TS/JS:  `X | null`  `X | undefined`  `X?`
    let t = raw.trim();
    const optMatch = /^Optional\s*\[\s*([^\]]+)\s*\]$/i.exec(t);
    if (optMatch) t = optMatch[1];
    const unionMatch = /^Union\s*\[\s*([^\]]+)\s*\]$/i.exec(t);
    if (unionMatch) t = unionMatch[1];
    t = t
      .split('|')
      .map((s) => s.trim())
      .filter((s) => !/^(none|null|undefined)$/i.test(s))
      .join(' | ');
    return t.replace(/\?\s*$/, '').trim();
  }

  private unwrapArray(t: string): string | null {
    // `X[]`
    const bracket = /^(.+)\[\]$/.exec(t);
    if (bracket) return bracket[1].trim();
    // `Array<X>` / `List<X>` / `Set<X>` / `Sequence<X>`
    const generic = /^(?:Array|List|Set|Sequence|Iterable|Collection)\s*<\s*([^>]+)\s*>$/i.exec(t);
    if (generic) return generic[1].trim();
    // Python: `List[X]` / `list[X]` / `Set[X]` / `Sequence[X]` / `Tuple[X, ...]`
    const pyGeneric = /^(?:List|list|Set|set|Sequence|Iterable|Tuple|tuple)\s*\[\s*([^,\]]+)(?:\s*,\s*\.\.\.)?\s*\]$/i.exec(t);
    if (pyGeneric) return pyGeneric[1].trim();
    return null;
  }

  private unwrapMap(t: string): string | null {
    // TS: `Record<K, V>` / `Map<K, V>`
    const tsMap = /^(?:Record|Map)\s*<\s*[^,]+,\s*([^>]+)\s*>$/i.exec(t);
    if (tsMap) return tsMap[1].trim();
    // Python: `Dict[K, V]` / `dict[K, V]` / `Mapping[K, V]`
    const pyMap = /^(?:Dict|dict|Mapping)\s*\[\s*[^,]+,\s*([^\]]+)\s*\]$/i.exec(t);
    if (pyMap) return pyMap[1].trim();
    // Bare `dict` / `Map` / `object` → any-value map
    if (/^(dict|Dict|Mapping|Map|object)$/.test(t)) return 'any';
    return null;
  }

  private matchKnownSchema(name: string, known: Set<string>): string | null {
    // Fast path
    if (known.has(name)) return name;
    // Try any known schema whose unprefixed tail matches (project-level
    // schemas are namespaced, e.g. `MOD-01_User`; if pseudo-code says `User`
    // we match the first suffix-match).
    for (const k of known) {
      if (k.endsWith(`_${name}`)) return k;
    }
    return null;
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
      // TS string-literal enum: `enum Status { LOW = 'low', HIGH = 'high' }`
      const enumRe = /(?:export\s+)?enum\s+([A-Z][\w$]*)\s*\{([^}]*)\}/gs;
      let m;
      while ((m = enumRe.exec(content)) !== null) {
        const { values, baseType } = this.parseTsEnumBody(m[2]);
        if (values.length > 0) {
          out.push({ name: m[1], properties: [], sourceFile, enumValues: values, enumBaseType: baseType });
        }
      }
      // interface Foo { a: string; b?: number }
      const ifaceRe = /(?:export\s+)?interface\s+([A-Z][\w$]*)\s*\{([^}]*)\}/gs;
      while ((m = ifaceRe.exec(content)) !== null) {
        const props = this.parseTsBody(m[2]);
        // Still emit even when empty — the schema builder handles zero-prop
        // schemas with a helpful description instead of suppressing them.
        out.push({ name: m[1], properties: props, sourceFile });
      }
      // class Foo { a: string; b?: number }
      const classRe = /(?:export\s+)?class\s+([A-Z][\w$]*)[^{]*\{([^}]*)\}/gs;
      while ((m = classRe.exec(content)) !== null) {
        const props = this.parseTsBody(m[2]);
        out.push({ name: m[1], properties: props, sourceFile });
      }
      // TS type alias of string-literal union: `type Severity = 'LOW' | 'MED'`
      const typeUnionRe = /(?:export\s+)?type\s+([A-Z][\w$]*)\s*=\s*([^;]+);?/g;
      while ((m = typeUnionRe.exec(content)) !== null) {
        const literals = [...m[2].matchAll(/['"]([^'"]+)['"]/g)].map((lm) => lm[1]);
        if (literals.length > 0) {
          out.push({ name: m[1], properties: [], sourceFile, enumValues: literals, enumBaseType: 'string' });
        }
      }
    } else if (lang === 'python') {
      // Python class body extraction. Previously used `\Z` which JS treats as
      // a literal "Z" character — leading to truncated / empty bodies. We now
      // delimit each class by scanning until the next top-level `class ` line
      // (column 0) or end-of-file via `$(?![\s\S])`.
      const classRe = /class\s+([A-Z]\w*)\s*(?:\(([^)]*)\))?\s*:\s*\n([\s\S]*?)(?=^class\s|^[A-Za-z_]|$(?![\s\S]))/gm;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const name = m[1];
        const bases = (m[2] ?? '').toLowerCase();
        const body = m[3];
        const isEnum = /\benum\b/.test(bases) || /^\s*class\s+\w+\s*\([^)]*(?:^|,\s*)(?:str\s*,\s*)?enum/i.test(`class ${name}(${m[2] ?? ''})`);
        if (isEnum) {
          const { values, baseType } = this.parsePythonEnumBody(body, bases);
          if (values.length > 0) {
            out.push({ name, properties: [], sourceFile, enumValues: values, enumBaseType: baseType });
            continue;
          }
        }
        const props = this.parsePythonBody(body);
        out.push({ name, properties: props, sourceFile });
      }
    } else if (lang === 'java') {
      // enum Foo { LOW, MED, HIGH }
      const enumRe = /(?:public\s+|private\s+|protected\s+)?enum\s+([A-Z]\w*)\s*\{([^}]*)\}/g;
      let m;
      while ((m = enumRe.exec(content)) !== null) {
        const values = [...m[2].matchAll(/\b([A-Z_][A-Z0-9_]*)\b/g)].map((lm) => lm[1]);
        if (values.length > 0) {
          out.push({ name: m[1], properties: [], sourceFile, enumValues: values, enumBaseType: 'string' });
        }
      }
      // class Foo { private String a; private Integer b; }
      const classRe = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+([A-Z]\w*)[^{]*\{([\s\S]*?)\}/g;
      while ((m = classRe.exec(content)) !== null) {
        const props = this.parseJavaBody(m[2]);
        out.push({ name: m[1], properties: props, sourceFile });
      }
    }

    return out;
  }

  private parseTsEnumBody(body: string): { values: string[]; baseType: 'string' | 'integer' } {
    const values: string[] = [];
    let baseType: 'string' | 'integer' = 'string';
    // `KEY = 'value'`  OR  `KEY = 123`  OR bare `KEY` (auto-number)
    const stringEnum = [...body.matchAll(/([A-Z_][A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/g)];
    if (stringEnum.length > 0) {
      for (const m of stringEnum) values.push(m[2]);
      return { values, baseType: 'string' };
    }
    const intEnum = [...body.matchAll(/([A-Z_][A-Z0-9_]*)\s*=\s*(-?\d+)/g)];
    if (intEnum.length > 0) {
      for (const m of intEnum) values.push(m[2]);
      return { values, baseType: 'integer' };
    }
    // Bare keys (TS auto-numbers) — emit key names as string values for readability.
    const bare = [...body.matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*,?\s*$/gm)];
    for (const m of bare) values.push(m[1]);
    return { values, baseType };
  }

  private parsePythonEnumBody(body: string, bases: string): { values: string[]; baseType: 'string' | 'integer' } {
    const values: string[] = [];
    const isInt = /\bintenum\b/.test(bases);
    const stringLit = [...body.matchAll(/^\s{0,8}([A-Z_][A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/gm)];
    if (stringLit.length > 0) {
      for (const m of stringLit) values.push(m[2]);
      return { values, baseType: 'string' };
    }
    const intLit = [...body.matchAll(/^\s{0,8}([A-Z_][A-Z0-9_]*)\s*=\s*(-?\d+)/gm)];
    if (intLit.length > 0) {
      for (const m of intLit) values.push(m[2]);
      return { values, baseType: 'integer' };
    }
    // `KEY = auto()` → use key name as the value
    const autoLit = [...body.matchAll(/^\s{0,8}([A-Z_][A-Z0-9_]*)\s*=\s*auto\s*\(\s*\)/gm)];
    for (const m of autoLit) values.push(m[1]);
    return { values, baseType: isInt ? 'integer' : 'string' };
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
