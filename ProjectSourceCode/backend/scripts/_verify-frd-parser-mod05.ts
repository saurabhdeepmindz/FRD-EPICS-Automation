/**
 * Read MOD-05's saved FRD content and run it through the same parsing
 * strategies the frontend now uses. Confirms Strategy 4 (table fallback)
 * picks up all 21 features and Strategy 3's tightening drops the bogus
 * "Note" capture.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Feature {
  featureId: string;
  featureName: string;
  rawBlock: string;
}

function isFeatureHeadingCandidate(trimmed: string): boolean {
  if (/^#{1,4}\s+\*?\*?F-\d+-\d+/.test(trimmed)) return true;
  if (/^\*\*F-\d+-\d+\b/.test(trimmed)) return true;
  if (/^\*\*Feature\s*ID\s*[:\-]/i.test(trimmed)) return true;
  return false;
}

function extract(content: string): Feature[] {
  const features: Feature[] = [];

  // Strategy 1
  const s1 = /#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—\-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|---\s*\n\s*#{1,4}\s+\*{0,2}F-|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = s1.exec(content)) !== null) {
    features.push({ featureId: m[1], featureName: m[2].replace(/\*+/g, '').trim(), rawBlock: m[3] });
  }

  const hasProperHeadingBlocks = features.length > 0;

  // Strategy 2
  if (!hasProperHeadingBlocks) {
    const s2 = /Feature\s*ID[:\s]+(F-\d+-\d+)\s*\n([\s\S]*?)(?=Feature\s*ID[:\s]+F-\d+-\d+|$)/gi;
    while ((m = s2.exec(content)) !== null) {
      features.push({ featureId: m[1], featureName: m[1], rawBlock: m[2] });
    }
  }

  // Strategy 3 (tightened)
  if (!hasProperHeadingBlocks && features.length === 0) {
    const lines = content.split('\n');
    let cur: Feature | null = null;
    const buf: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (isFeatureHeadingCandidate(t)) {
        const idM = t.match(/\b(F-\d+-\d+)\b/);
        if (idM) {
          if (cur) {
            cur.rawBlock = buf.join('\n');
            features.push(cur);
          }
          cur = { featureId: idM[1], featureName: t.replace(/[#*`]/g, '').replace(idM[1], '').replace(/[:\-—]/g, ' ').trim() || idM[1], rawBlock: '' };
          buf.length = 0;
          continue;
        }
      }
      if (cur) buf.push(line);
    }
    if (cur) {
      cur.rawBlock = buf.join('\n');
      features.push(cur);
    }
  }

  // Strategy 4 (additive when Strategy 1 didn't match)
  if (!hasProperHeadingBlocks) {
    const tableRe = /^\s*\|\s*(F-\d+-\d+)\s*\|\s*([^|]+?)\s*\|/gm;
    const seen = new Set(features.map((f) => f.featureId));
    while ((m = tableRe.exec(content)) !== null) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      features.push({ featureId: m[1], featureName: m[2].replace(/\*+/g, '').trim(), rawBlock: m[0] });
    }
  }

  // Dedupe — keep entry with longest rawBlock
  const byId = new Map<string, Feature>();
  for (const f of features) {
    const e = byId.get(f.featureId);
    if (!e || f.rawBlock.length > e.rawBlock.length) byId.set(f.featureId, f);
  }
  return [...byId.values()].sort((a, b) => a.featureId.localeCompare(b.featureId, undefined, { numeric: true }));
}

async function check(moduleId: string): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) {
    console.log(`${moduleId}: module not found`);
    return;
  }
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) {
    console.log(`${moduleId}: FRD artifact not found`);
    return;
  }
  const fullContent = frd.sections.map((s) => s.content).join('\n\n');
  const out = extract(fullContent);
  console.log(`\n${moduleId} parser run — features extracted: ${out.length}`);
  for (const f of out) {
    console.log(`  ${f.featureId.padEnd(8)} ${f.featureName.slice(0, 60)}`);
  }
}

async function main(): Promise<void> {
  await check('MOD-01');
  await check('MOD-05');
}
main().catch(console.error).finally(() => prisma.$disconnect());
