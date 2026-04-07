'use client';

import { cn } from '@/lib/utils';
import { AISuggestButton } from './AISuggestButton';
import { MicButton } from './MicButton';

interface FormFieldProps {
  label: string;
  fieldKey: string;
  value: string;
  onChange: (key: string, value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  aiSuggesting?: boolean;
  aiHighlighted?: boolean;
  onAISuggest?: () => void;
}

export function FormField({
  label,
  fieldKey,
  value,
  onChange,
  multiline = false,
  rows = 4,
  placeholder,
  aiSuggesting,
  aiHighlighted,
  onAISuggest,
}: FormFieldProps) {
  const isAiContent = value.trimStart().startsWith('[AI]');

  const inputClasses = cn(
    'w-full rounded-md border px-3 py-2 text-sm bg-background transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
    aiHighlighted ? 'border-amber-400 bg-amber-50/50' : 'border-input',
    isAiContent && 'text-blue-600',
  );

  return (
    <div className="space-y-1.5" data-testid={`form-field-${fieldKey}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-1">
          <MicButton
            size="sm"
            onTranscribed={(text) => onChange(fieldKey, value ? `${value}\n${text}` : text)}
          />
          {onAISuggest && (
            <AISuggestButton onClick={onAISuggest} loading={aiSuggesting} />
          )}
        </div>
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={cn(inputClasses, 'resize-y')}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}
      {aiHighlighted && (
        <p className="text-xs text-amber-600">AI suggested — edit as needed</p>
      )}
      {isAiContent && !aiHighlighted && (
        <p className="text-xs text-blue-500">AI-generated content — displayed in blue</p>
      )}
    </div>
  );
}
