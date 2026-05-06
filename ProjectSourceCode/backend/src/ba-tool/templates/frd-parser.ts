/**
 * Parse FRD markdown output into structured feature objects.
 * Extracts F-XX-XX feature blocks with their fields.
 *
 * NOTE: This is a server-side mirror of `frontend/lib/frd-parser.ts`. The two
 * files are intentionally byte-equivalent (same parsing rules → same feature
 * shape on every surface: editor, preview, PDF, DOCX). When changing parsing
 * behaviour, update both copies in lockstep.
 */

export interface ParsedFeature {
  featureId: string;
  featureName: string;
  description: string;
  priority: string;
  status: string; // CONFIRMED, CONFIRMED-PARTIAL, DRAFT
  screenRef: string;
  trigger: string;
  preConditions: string;
  postConditions: string;
  businessRules: string;
  validations: string;
  integrationSignals: string;
  acceptanceCriteria: string;
  rawBlock: string; // original markdown block
}

export interface ParsedFrdModule {
  moduleId: string;
  moduleName: string;
  packageName: string;
  moduleDescription: string;
  features: ParsedFeature[];
  businessRules: string;
  validations: string;
  tbdFutureRegistry: string;
  otherSections: { label: string; content: string }[];
}

/**
 * Parse FRD artifact sections into structured module + features.
 * Works with both well-structured and loosely-structured AI output.
 */
export function parseFrdContent(sections: { sectionKey: string; sectionLabel: string; content: string }[]): ParsedFrdModule {
  const result: ParsedFrdModule = {
    moduleId: '',
    moduleName: '',
    packageName: '',
    moduleDescription: '',
    features: [],
    businessRules: '',
    validations: '',
    tbdFutureRegistry: '',
    otherSections: [],
  };

  // Concatenate all sections to find features across the entire output
  const fullContent = sections.map((s) => s.content).join('\n\n');

  // Extract module-level info from any section
  const moduleIdMatch = fullContent.match(/Module\s*ID[:\s]+([A-Z]+-\d+)/i);
  if (moduleIdMatch) result.moduleId = moduleIdMatch[1];

  const moduleNameMatch = fullContent.match(/Module\s*Name[:\s]+(.+)/i);
  if (moduleNameMatch) result.moduleName = moduleNameMatch[1].trim();

  const packageMatch = fullContent.match(/Package\s*(?:Name)?[:\s]+([a-z_]+)/i);
  if (packageMatch) result.packageName = packageMatch[1];

  // Extract features — look for F-XX-XX patterns
  result.features = extractFeatures(fullContent);

  // Categorize remaining sections
  for (const section of sections) {
    const key = section.sectionKey.toLowerCase();
    if (key.includes('business_rule') || key.includes('businessrule')) {
      result.businessRules = section.content;
    } else if (key.includes('validation')) {
      result.validations = section.content;
    } else if (key.includes('tbd') || key.includes('future') || key.includes('registry')) {
      result.tbdFutureRegistry = section.content;
    } else if (key.includes('module_overview') || key.includes('module_identification') || key.includes('purpose')) {
      result.moduleDescription = section.content;
    } else if (!containsFeatureBlocks(section.content)) {
      result.otherSections.push({ label: section.sectionLabel, content: section.content });
    }
  }

  return result;
}

function containsFeatureBlocks(content: string): boolean {
  return /F-\d+-\d+/i.test(content);
}

function extractFeatures(content: string): ParsedFeature[] {
  const features: ParsedFeature[] = [];

  const featureRegex = /#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|---\s*\n\s*#{1,4}\s+\*{0,2}F-|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = featureRegex.exec(content)) !== null) {
    const featureId = match[1];
    const featureName = match[2].replace(/\*+/g, '').trim();
    const block = match[3];

    features.push(parseFeatureBlock(featureId, featureName, block));
  }

  const hasProperHeadingBlocks = features.length > 0;

  if (!hasProperHeadingBlocks) {
    const altRegex = /Feature\s*ID[:\s]+(F-\d+-\d+)\s*\n([\s\S]*?)(?=Feature\s*ID[:\s]+F-\d+-\d+|$)/gi;
    while ((match = altRegex.exec(content)) !== null) {
      const featureId = match[1];
      const block = match[2];
      const nameMatch = block.match(/Feature\s*Name[:\s]+(.+)/i);
      const featureName = nameMatch ? nameMatch[1].trim() : featureId;
      features.push(parseFeatureBlock(featureId, featureName, block));
    }
  }

  if (!hasProperHeadingBlocks && features.length === 0) {
    const lines = content.split('\n');
    let currentFeature: Partial<ParsedFeature> | null = null;
    let currentBlock: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (isFeatureHeadingCandidate(trimmed)) {
        const idMatch = trimmed.match(/\b(F-\d+-\d+)\b/);
        if (idMatch) {
          if (currentFeature?.featureId) {
            features.push(parseFeatureBlock(
              currentFeature.featureId,
              currentFeature.featureName ?? currentFeature.featureId,
              currentBlock.join('\n'),
            ));
          }
          currentFeature = {
            featureId: idMatch[1],
            featureName: trimmed
              .replace(/[#*`]/g, '')
              .replace(idMatch[1], '')
              .replace(/[:\-—]/g, ' ')
              .trim()
              || idMatch[1],
          };
          currentBlock = [];
          continue;
        }
      }
      if (currentFeature) {
        currentBlock.push(line);
      }
    }
    if (currentFeature?.featureId) {
      features.push(parseFeatureBlock(
        currentFeature.featureId,
        currentFeature.featureName ?? currentFeature.featureId,
        currentBlock.join('\n'),
      ));
    }
  }

  if (!hasProperHeadingBlocks) {
    const tableRowRe = /^\s*\|\s*(F-\d+-\d+)\s*\|\s*([^|]+?)\s*\|/gm;
    let m: RegExpExecArray | null;
    const seen = new Set(features.map((f) => f.featureId));
    while ((m = tableRowRe.exec(content)) !== null) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const name = m[2].replace(/\*+/g, '').trim();
      features.push(parseFeatureBlock(id, name, m[0]));
    }
  }

  const byId = new Map<string, ParsedFeature>();
  for (const f of features) {
    const existing = byId.get(f.featureId);
    if (!existing || (f.rawBlock?.length ?? 0) > (existing.rawBlock?.length ?? 0)) {
      byId.set(f.featureId, f);
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.featureId.localeCompare(b.featureId, undefined, { numeric: true }),
  );
}

function isFeatureHeadingCandidate(trimmed: string): boolean {
  if (/^#{1,4}\s+\*?\*?F-\d+-\d+/.test(trimmed)) return true;
  if (/^\*\*F-\d+-\d+\b/.test(trimmed)) return true;
  if (/^\*\*Feature\s*ID\s*[:\-]/i.test(trimmed)) return true;
  return false;
}

function parseFeatureBlock(featureId: string, featureName: string, block: string): ParsedFeature {
  return {
    featureId,
    featureName,
    description: extractField(block, ['Feature Description', 'Description', 'feature description']),
    priority: extractField(block, ['Priority', 'MoSCoW', 'priority']),
    status: extractField(block, ['Status', 'Feature Status', 'status']) || 'CONFIRMED',
    screenRef: extractField(block, ['Screen Reference', 'Screen Ref', 'Screen', 'screen']),
    trigger: extractField(block, ['Trigger', 'trigger']),
    preConditions: extractField(block, ['Pre-conditions', 'Pre-condition', 'Preconditions', 'Prerequisites']),
    postConditions: extractField(block, ['Post-conditions', 'Post-condition', 'Postconditions']),
    businessRules: extractField(block, ['Business Rules', 'Business Rule', 'Rules']),
    validations: extractField(block, ['Validations', 'Validation']),
    integrationSignals: extractField(block, ['Integration Signals', 'Integration', 'Integrations']),
    acceptanceCriteria: extractField(block, ['Acceptance Criteria', 'Acceptance']),
    rawBlock: block,
  };
}

function extractField(block: string, labels: string[]): string {
  const lines = block.split('\n');
  const lowerLabels = labels.map((l) => l.toLowerCase());

  const nextLabelRe = /^\s{0,1}[-*]\s+\*{1,2}[^*\n:]+(?::\*{1,2}|\*{1,2}\s*:)/;
  const headingRe = /^#{1,6}\s/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = line.replace(/^\s*[-*]*\s*/, '').replace(/\*{1,2}/g, '').trim();
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx < 1) continue;

    const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
    const lineValue = cleaned.substring(colonIdx + 1).trim();

    let matched = false;
    for (const target of lowerLabels) {
      if (lineLabel === target || lineLabel.includes(target) || target.includes(lineLabel)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;

    if (lineValue) return lineValue;

    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (nextLabelRe.test(next)) break;
      if (headingRe.test(next)) break;
      collected.push(next);
    }
    while (collected.length > 0 && !collected[0].trim()) collected.shift();
    while (collected.length > 0 && !collected[collected.length - 1].trim()) collected.pop();
    if (collected.length === 0) return '';

    const normalised = collected.map((l) => (l.startsWith('  ') ? l.slice(2) : l));
    return normalised.join('\n').trim();
  }
  return '';
}
