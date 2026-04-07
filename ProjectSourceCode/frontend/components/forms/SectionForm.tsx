'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from './FormField';
import { useAISuggest } from '@/hooks/useAISuggest';
import { SECTION_FIELDS, type FieldDef } from '@/lib/section-fields';
import { getSectionMeta } from '@/lib/section-config';
import { Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { SectionHistory } from './SectionHistory';

/** Fields shown when a specific feature is selected */
const FEATURE_FIELDS: FieldDef[] = [
  { key: 'featureId', label: 'Feature ID', placeholder: 'e.g., FR-AUTH-001' },
  { key: 'featureName', label: 'Feature Name', placeholder: 'e.g., Email/Password Registration' },
  { key: 'description', label: 'Description', multiline: true, rows: 4, placeholder: 'The system shall...' },
  { key: 'businessRule', label: 'Business Rule', multiline: true, rows: 3, placeholder: 'Business rules and constraints' },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', multiline: true, rows: 4, placeholder: 'Given-When-Then or checklist format' },
  { key: 'priority', label: 'Priority', placeholder: 'P0 (Must Have) / P1 (Should Have) / P2 (Nice to Have)' },
];

interface SectionFormProps {
  prdId: string;
  sectionNumber: number;
  initialContent: Record<string, unknown>;
  onSave: (content: Record<string, unknown>, aiSuggested: boolean) => Promise<void>;
  onPrevious?: () => void;
  onNext?: () => void;
  activeSubTab?: string;
  activeFeatureId?: string;
  onFeatureSelect?: (featureId: string) => void;
}

export function SectionForm({
  prdId,
  sectionNumber,
  initialContent,
  onSave,
  onPrevious,
  onNext,
  activeSubTab,
  activeFeatureId,
  onFeatureSelect,
}: SectionFormProps) {
  const meta = getSectionMeta(sectionNumber);
  const { suggest, suggesting } = useAISuggest();

  // Determine which fields to show
  const isFeatureView = sectionNumber === 6 && activeSubTab && activeFeatureId;
  const isModuleView = sectionNumber === 6 && activeSubTab && !activeFeatureId;
  const fields = isFeatureView ? FEATURE_FIELDS : (SECTION_FIELDS[sectionNumber] ?? []);
  const subPrefix = activeSubTab ? `${activeSubTab}_` : '';

  // Get features list for module-level summary
  const featuresKey = `${subPrefix}features`;
  const featuresList = (isModuleView && Array.isArray(initialContent[featuresKey]))
    ? (initialContent[featuresKey] as Record<string, string>[])
    : [];

  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [suggestingField, setSuggestingField] = useState<string | null>(null);

  // Build form data from content
  function buildFormData(): Record<string, string> {
    if (isFeatureView) {
      // Feature view: read from the features array in content
      const featuresKey = `${subPrefix}features`;
      const features = initialContent[featuresKey];
      if (Array.isArray(features)) {
        const feat = (features as Record<string, string>[]).find(
          (f) => f.featureId === activeFeatureId,
        );
        if (feat) {
          const data: Record<string, string> = {};
          for (const field of FEATURE_FIELDS) {
            data[field.key] = String(feat[field.key] ?? '');
          }
          return data;
        }
      }
      // Fallback: empty
      return Object.fromEntries(FEATURE_FIELDS.map((f) => [f.key, '']));
    }

    // Standard section/sub-tab view
    const data: Record<string, string> = {};
    for (const field of fields) {
      const prefixedKey = `${subPrefix}${field.key}`;
      const prefixedVal = initialContent[prefixedKey];
      const flatVal = initialContent[field.key];
      const value = prefixedVal ?? flatVal ?? '';
      data[field.key] = String(value);
    }
    return data;
  }

  const [formData, setFormData] = useState<Record<string, string>>(buildFormData);

  useEffect(() => {
    setFormData(buildFormData());
    setAiFields(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionNumber, activeSubTab, activeFeatureId]);

  const handleChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAISuggest = useCallback(
    async (fieldKey: string) => {
      setSuggestingField(fieldKey);
      try {
        const contextParts = Object.entries(formData)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `${k}: ${v}`);
        const context = contextParts.join('\n');

        const suggestion = await suggest(sectionNumber, fieldKey, context);
        setFormData((prev) => ({ ...prev, [fieldKey]: suggestion }));
        setAiFields((prev) => new Set([...prev, fieldKey]));
      } finally {
        setSuggestingField(null);
      }
    },
    [formData, sectionNumber, suggest],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const content: Record<string, unknown> = { ...initialContent };

      if (isFeatureView) {
        // Save back into the features array
        const featuresKey = `${subPrefix}features`;
        const features = Array.isArray(initialContent[featuresKey])
          ? [...(initialContent[featuresKey] as Record<string, string>[])]
          : [];

        const idx = features.findIndex((f) => f.featureId === activeFeatureId);
        const updatedFeature: Record<string, string> = {};
        for (const field of FEATURE_FIELDS) {
          updatedFeature[field.key] = formData[field.key] ?? '';
        }

        if (idx >= 0) {
          features[idx] = updatedFeature;
        } else {
          features.push(updatedFeature);
        }
        content[featuresKey] = features;
      } else {
        // Standard save with prefix
        for (const field of fields) {
          const storageKey = `${subPrefix}${field.key}`;
          content[storageKey] = formData[field.key] ?? '';
        }
      }

      await onSave(content, aiFields.size > 0);
    } finally {
      setSaving(false);
    }
  }, [formData, initialContent, fields, subPrefix, aiFields, onSave, isFeatureView, activeFeatureId]);

  // Header text
  let headerTitle = `Section ${sectionNumber} — ${meta?.name ?? 'Unknown'}`;
  let headerSub = activeSubTab ? `Sub-section: ${activeSubTab}` : undefined;
  if (isFeatureView) {
    headerSub = `${activeSubTab} — ${activeFeatureId}`;
  }

  return (
    <div data-testid={`section-form-${sectionNumber}`} className="flex flex-col h-full">
      {/* Section header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{headerTitle}</h2>
          <SectionHistory prdId={prdId} sectionNumber={sectionNumber} />
        </div>
        {headerSub && (
          <p className="text-sm text-muted-foreground mt-1">{headerSub}</p>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {fields.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            fieldKey={field.key}
            value={formData[field.key] ?? ''}
            onChange={handleChange}
            multiline={field.multiline}
            rows={field.rows}
            placeholder={field.placeholder}
            aiSuggesting={suggestingField === field.key}
            aiHighlighted={aiFields.has(field.key)}
            onAISuggest={() => handleAISuggest(field.key)}
          />
        ))}

        {/* Features list summary — shown only on module view */}
        {isModuleView && featuresList.length > 0 && (
          <div className="space-y-2" data-testid="features-list-summary">
            <label className="text-sm font-medium text-foreground">
              List of Features ({featuresList.length})
            </label>
            <div className="rounded-md border border-border bg-muted/30 divide-y divide-border">
              {featuresList.map((feat, idx) => (
                <div key={feat.featureId || idx} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <button
                    onClick={() => onFeatureSelect?.(feat.featureId)}
                    className="font-mono text-xs text-primary shrink-0 bg-primary/10 px-1.5 py-0.5 rounded hover:bg-primary/20 hover:underline cursor-pointer transition-colors"
                    title={`Go to ${feat.featureId} — ${feat.featureName}`}
                  >
                    {feat.featureId}
                  </button>
                  <span className="text-foreground">{feat.featureName}</span>
                  {feat.priority && (
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{feat.priority}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a feature in the left sidebar to view/edit its details.
            </p>
          </div>
        )}

        {isModuleView && featuresList.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No features added yet. Use the AI Suggest button or add features manually via the sidebar.
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!onPrevious}
          data-testid="btn-previous"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || suggesting}
          data-testid="btn-save"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save & Continue
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!onNext}
          data-testid="btn-next"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
