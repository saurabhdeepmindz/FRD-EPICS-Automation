/**
 * Parse FRD markdown output into structured feature objects.
 * Extracts F-XX-XX feature blocks with their fields.
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

  // Strategy 1: Look for #### **F-XX-XX: Name** patterns (bold-wrapped feature headings)
  // Handles: #### **F-01-01: Assign Tasks from Dashboard**
  //          #### F-01-01: Assign Tasks
  //          #### **F-01-01** — Assign Tasks
  const featureRegex = /#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|---\s*\n\s*#{1,4}\s+\*{0,2}F-|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = featureRegex.exec(content)) !== null) {
    const featureId = match[1];
    const featureName = match[2].replace(/\*+/g, '').trim();
    const block = match[3];

    features.push(parseFeatureBlock(featureId, featureName, block));
  }

  // Strategy 2: If no heading-style features found, try "Feature ID: F-XX-XX" blocks
  if (features.length === 0) {
    const altRegex = /Feature\s*ID[:\s]+(F-\d+-\d+)\s*\n([\s\S]*?)(?=Feature\s*ID[:\s]+F-\d+-\d+|$)/gi;
    while ((match = altRegex.exec(content)) !== null) {
      const featureId = match[1];
      const block = match[2];
      const nameMatch = block.match(/Feature\s*Name[:\s]+(.+)/i);
      const featureName = nameMatch ? nameMatch[1].trim() : featureId;
      features.push(parseFeatureBlock(featureId, featureName, block));
    }
  }

  // Strategy 3: Simple line-by-line scan for F-XX-XX patterns
  if (features.length === 0) {
    const lines = content.split('\n');
    let currentFeature: Partial<ParsedFeature> | null = null;
    let currentBlock: string[] = [];

    for (const line of lines) {
      const idMatch = line.match(/\b(F-\d+-\d+)\b/);
      if (idMatch && (line.includes('#') || line.includes('**') || line.includes('Feature'))) {
        // Save previous feature
        if (currentFeature?.featureId) {
          features.push(parseFeatureBlock(
            currentFeature.featureId,
            currentFeature.featureName ?? currentFeature.featureId,
            currentBlock.join('\n'),
          ));
        }
        currentFeature = {
          featureId: idMatch[1],
          featureName: line.replace(/[#*]/g, '').replace(idMatch[1], '').replace(/[:\-—]/g, '').trim(),
        };
        currentBlock = [];
      } else if (currentFeature) {
        currentBlock.push(line);
      }
    }
    // Save last feature
    if (currentFeature?.featureId) {
      features.push(parseFeatureBlock(
        currentFeature.featureId,
        currentFeature.featureName ?? currentFeature.featureId,
        currentBlock.join('\n'),
      ));
    }
  }

  return features;
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

  for (const line of lines) {
    // Strip markdown formatting to get clean label: value
    // Handles: "- **Feature Description:** value", "**Label:** value", "Label: value"
    const cleaned = line.replace(/^\s*[-*]*\s*/, '').replace(/\*{1,2}/g, '').trim();
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx < 1) continue;

    const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
    const lineValue = cleaned.substring(colonIdx + 1).trim();

    if (!lineValue) continue;

    for (const target of lowerLabels) {
      if (lineLabel === target || lineLabel.includes(target) || target.includes(lineLabel)) {
        return lineValue;
      }
    }
  }
  return '';
}
