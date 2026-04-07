'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ModeToggle } from './ModeToggle';
import { FileDropzone } from './FileDropzone';
import { GapWizard } from './GapWizard';
import { Sparkles, Loader2, BookOpen, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { MicButton } from '@/components/forms/MicButton';
import { parseRequirements, uploadAndExtract, gapCheck } from '@/lib/api';
import type { GapItem, ParseResponse } from '@/lib/api';
import Link from 'next/link';

interface ConversationalTabProps {
  onParsed: (sections: Record<string, Record<string, string>>, gaps: GapItem[]) => void;
}

export function ConversationalTab({ onParsed }: ConversationalTabProps) {
  const [mode, setMode] = useState<'all_in_one' | 'interactive'>('all_in_one');
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive mode state
  const [showGapWizard, setShowGapWizard] = useState(false);
  const [sections, setSections] = useState<Record<string, Record<string, string>>>({});
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [gapCheckLoading, setGapCheckLoading] = useState(false);

  // Original input display
  const [originalInput, setOriginalInput] = useState('');
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [showOriginalInput, setShowOriginalInput] = useState(false);

  const hasInput = rawText.trim().length > 0 || selectedFile !== null;

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setRawText('');
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setRawText(text);
    if (text.trim()) setSelectedFile(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    setParsing(true);
    setError(null);
    try {
      let text = rawText;

      if (selectedFile) {
        const extracted = await uploadAndExtract(selectedFile);
        text = extracted.text;
        setOriginalFileName(selectedFile.name);
      }

      if (!text.trim()) {
        setError('No text to parse. Please paste text or upload a document.');
        return;
      }

      // Store original input for reference (in-memory and sessionStorage for persistence)
      setOriginalInput(text);
      sessionStorage.setItem('prdSourceText', text);
      if (selectedFile) {
        sessionStorage.setItem('prdSourceFileName', selectedFile.name);
        // Store file as base64 for DB persistence (Phase 1)
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            sessionStorage.setItem('prdSourceFileData', reader.result);
          }
        };
        reader.readAsDataURL(selectedFile);
      } else {
        sessionStorage.removeItem('prdSourceFileName');
        sessionStorage.removeItem('prdSourceFileData');
      }

      const result: ParseResponse = await parseRequirements({ text, mode });

      if (mode === 'interactive') {
        setSections(result.sections);
        setGaps(result.gaps);
        setShowGapWizard(true);
      } else {
        onParsed(result.sections, result.gaps);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse requirements. Please try again.';
      setError(msg);
    } finally {
      setParsing(false);
    }
  }, [rawText, selectedFile, mode, onParsed]);

  const handleGapAnswers = useCallback(async (answers: string) => {
    setGapCheckLoading(true);
    try {
      const result = await gapCheck({ sections, answers });
      setSections(result.updatedSections);
      setGaps(result.remainingGaps);
    } finally {
      setGapCheckLoading(false);
    }
  }, [sections]);

  const handleProceedToReview = useCallback(() => {
    onParsed(sections, gaps);
  }, [sections, gaps, onParsed]);

  return (
    <div className="space-y-6" data-testid="conversational-tab">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <ModeToggle mode={mode} onModeChange={setMode} />
        <Link href="/templates" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
          <BookOpen className="h-3.5 w-3.5" />
          View PRD Template Guide
        </Link>
      </div>

      {!showGapWizard ? (
        <>
          {/* Text input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Describe your product or paste requirements</label>
              <MicButton
                size="md"
                onTranscribed={(text) => handleTextChange(rawText ? `${rawText}\n${text}` : text)}
              />
            </div>
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={8}
              placeholder="Paste your meeting notes, BRD content, product description, or rough idea here..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={!!selectedFile}
              data-testid="conv-textarea"
            />
            <p className="text-xs text-muted-foreground">{rawText.length.toLocaleString()} / 60,000 characters</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* File upload */}
          <FileDropzone
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={() => setSelectedFile(null)}
          />

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive" data-testid="conv-error">{error}</p>
          )}

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!hasInput || parsing}
            className="w-full"
            size="lg"
            data-testid="btn-generate"
          >
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysing your input...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate PRD Draft
              </>
            )}
          </Button>
        </>
      ) : (
        <>
          {/* ── Original input (collapsible) ── */}
          <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid="original-input-section">
            <button
              onClick={() => setShowOriginalInput((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Your Original Input</span>
                {originalFileName && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {originalFileName}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  ({originalInput.length.toLocaleString()} chars)
                </span>
              </div>
              {showOriginalInput ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showOriginalInput && (
              <div className="px-4 pb-4 border-t border-border">
                <div className="mt-3 max-h-[300px] overflow-y-auto rounded-md border border-dashed border-border bg-muted/30 p-3">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {originalInput}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* ── Gap Wizard ── */}
          <GapWizard
            gaps={gaps}
            onSubmitAll={handleGapAnswers}
            onProceedToReview={handleProceedToReview}
            loading={gapCheckLoading}
          />
        </>
      )}
    </div>
  );
}
