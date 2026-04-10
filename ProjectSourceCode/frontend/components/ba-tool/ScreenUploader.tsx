'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  uploadBaScreensBatch,
  updateBaScreen,
  deleteBaScreen,
  uploadBaScreenAudio,
  saveBaTranscript,
  formatBaTranscript,
  saveAiFormattedTranscript,
  type BaScreen,
} from '@/lib/ba-api';
import { transcribeAudio } from '@/lib/api';
import {
  Upload, Loader2, Trash2, Image as ImageIcon,
  ChevronDown, ChevronUp, Mic, MicOff, Check, FileText, Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenUploaderProps {
  moduleDbId: string;
  screens: BaScreen[];
  onScreensChanged: () => void;
}

const SCREEN_TYPES = ['Dashboard', 'Form', 'List', 'Detail', 'Modal', 'Navigation', 'Other'] as const;

export function ScreenUploader({ moduleDbId, screens, onScreensChanged }: ScreenUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setUploading(true);
    try {
      await uploadBaScreensBatch(moduleDbId, imageFiles);
      onScreensChanged();
    } catch {
      alert('Failed to upload screens');
    } finally {
      setUploading(false);
    }
  }, [moduleDbId, onScreensChanged]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-6" data-testid="screen-uploader">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploading screens...</span>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              Drop Figma screen images here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP — multiple files supported</p>
          </>
        )}
      </div>

      {/* Screen cards */}
      {screens.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Uploaded Screens ({screens.length})
          </h3>
          <div className="space-y-4">
            {screens.map((screen) => (
              <ScreenCard
                key={screen.id}
                screen={screen}
                onChanged={onScreensChanged}
              />
            ))}
          </div>
        </div>
      )}

      {screens.length === 0 && !uploading && (
        <div className="text-center py-8">
          <ImageIcon className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No screens uploaded yet</p>
        </div>
      )}
    </div>
  );
}

// ─── Individual Screen Card with expandable description ──────────────────────

function ScreenCard({ screen, onChanged }: { screen: BaScreen; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'ai-formatted'>('text');
  const [textDesc, setTextDesc] = useState(screen.textDescription ?? '');
  const [savingText, setSavingText] = useState(false);
  const [textSaved, setTextSaved] = useState(!!screen.textDescription);
  const [transcript, setTranscript] = useState(screen.audioTranscript ?? '');
  const [recording, setRecording] = useState(false);
  const [aiFormatted, setAiFormatted] = useState(screen.aiFormattedTranscript ?? '');
  const [formatting, setFormatting] = useState(false);
  const [savingAiTranscript, setSavingAiTranscript] = useState(false);

  // Sync local state when screen prop updates (after parent reload)
  useEffect(() => { setTextDesc(screen.textDescription ?? ''); setTextSaved(!!screen.textDescription); }, [screen.textDescription]);
  useEffect(() => { setTranscript(screen.audioTranscript ?? ''); }, [screen.audioTranscript]);
  useEffect(() => { setAiFormatted(screen.aiFormattedTranscript ?? ''); }, [screen.aiFormattedTranscript]);
  const [transcribing, setTranscribing] = useState(false);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSaveText = useCallback(async () => {
    setSavingText(true);
    try {
      await updateBaScreen(screen.id, { textDescription: textDesc });
      setTextSaved(true);
      onChanged();
    } catch {
      alert('Failed to save description');
    } finally {
      setSavingText(false);
    }
  }, [screen.id, textDesc, onChanged]);

  const handleTitleChange = useCallback(async (title: string) => {
    await updateBaScreen(screen.id, { screenTitle: title });
  }, [screen.id]);

  const handleTypeChange = useCallback(async (type: string) => {
    await updateBaScreen(screen.id, { screenType: type });
    onChanged();
  }, [screen.id, onChanged]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this screen?')) return;
    await deleteBaScreen(screen.id);
    onChanged();
  }, [screen.id, onChanged]);

  // ── Audio recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''];
      let mimeType = '';
      for (const t of types) {
        if (t === '' || MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
      }
      const options: MediaRecorderOptions = {};
      if (mimeType) options.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size < 100) return;

        // Upload audio to backend
        try {
          await uploadBaScreenAudio(screen.id, blob);
        } catch { /* audio storage optional */ }

        // Transcribe
        setTranscribing(true);
        try {
          const result = await transcribeAudio(blob);
          if (result.text.trim()) {
            setTranscript(result.text.trim());
            await saveBaTranscript(screen.id, result.text.trim(), false);
            onChanged();
          }
        } catch {
          alert('Transcription failed');
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start(250);
      setRecording(true);
    } catch {
      alert('Microphone access denied');
    }
  }, [screen.id, onChanged]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const handleConfirmTranscript = useCallback(async () => {
    setSavingTranscript(true);
    try {
      await saveBaTranscript(screen.id, transcript, true);
      onChanged();
    } catch {
      alert('Failed to save transcript');
    } finally {
      setSavingTranscript(false);
    }
  }, [screen.id, transcript, onChanged]);

  const handleAiFormat = useCallback(async () => {
    setFormatting(true);
    try {
      const result = await formatBaTranscript(screen.id);
      setAiFormatted(result.formattedText);
      setActiveTab('ai-formatted');
      onChanged();
    } catch {
      alert('AI formatting failed');
    } finally {
      setFormatting(false);
    }
  }, [screen.id, onChanged]);

  const handleSaveAiTranscript = useCallback(async (reviewed: boolean) => {
    setSavingAiTranscript(true);
    try {
      await saveAiFormattedTranscript(screen.id, aiFormatted, reviewed);
      onChanged();
    } catch {
      alert('Failed to save AI transcript');
    } finally {
      setSavingAiTranscript(false);
    }
  }, [screen.id, aiFormatted, onChanged]);

  // Status indicators
  const hasText = !!screen.textDescription?.trim();
  const hasAudio = !!screen.audioTranscript;
  const audioConfirmed = screen.transcriptReviewed;
  const hasAiFormatted = !!screen.aiFormattedTranscript;
  const aiFormatConfirmed = screen.aiTranscriptReviewed;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid={`screen-card-${screen.screenId}`}>
      {/* Card header — image + metadata */}
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative w-40 h-24 shrink-0 rounded-md overflow-hidden bg-muted">
          {screen.fileData ? (
            <img src={screen.fileData} alt={screen.screenTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
            {screen.screenId}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between">
            <input
              type="text"
              defaultValue={screen.screenTitle}
              onBlur={(e) => handleTitleChange(e.target.value)}
              className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors w-full mr-2"
              placeholder="Screen title..."
            />
            <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <select
            defaultValue={screen.screenType ?? ''}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="text-xs bg-muted/50 border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">Select type...</option>
            {SCREEN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-3 text-[10px]">
            <span className={cn('flex items-center gap-1', hasText ? 'text-green-600' : 'text-muted-foreground')}>
              <FileText className="h-3 w-3" /> {hasText ? 'Text added' : 'No text'}
            </span>
            <span className={cn('flex items-center gap-1',
              audioConfirmed ? 'text-green-600' : hasAudio ? 'text-amber-600' : 'text-muted-foreground',
            )}>
              <Volume2 className="h-3 w-3" />
              {audioConfirmed ? 'Audio confirmed' : hasAudio ? 'Review transcript' : 'No audio'}
            </span>
            {hasAiFormatted && (
              <>
                <span className="text-muted-foreground">&middot;</span>
                <span className={cn('flex items-center gap-1',
                  aiFormatConfirmed ? 'text-blue-600' : 'text-blue-400',
                )}>
                  {aiFormatConfirmed ? 'AI Formatted' : 'AI draft'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expand/collapse description toggle */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Collapse descriptions' : 'Add descriptions (text / audio)'}
      </button>

      {/* Expanded description area */}
      {expanded && (
        <div className="border-t border-border">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('text')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                activeTab === 'text' ? 'bg-card text-foreground border-b-2 border-primary' : 'bg-muted/30 text-muted-foreground',
              )}
            >
              <FileText className="h-3 w-3 inline mr-1" />
              Text Description
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                activeTab === 'audio' ? 'bg-card text-foreground border-b-2 border-primary' : 'bg-muted/30 text-muted-foreground',
              )}
            >
              <Volume2 className="h-3 w-3 inline mr-1" />
              Audio Description
              {hasAudio && !audioConfirmed && (
                <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">review</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ai-formatted')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                activeTab === 'ai-formatted' ? 'bg-card text-foreground border-b-2 border-blue-500' : 'bg-muted/30 text-muted-foreground',
              )}
            >
              <span className="text-blue-500 mr-1">AI</span>
              Formatted
              {hasAiFormatted && !aiFormatConfirmed && (
                <span className="ml-1 text-[9px] bg-blue-100 text-blue-700 px-1 rounded">review</span>
              )}
              {aiFormatConfirmed && (
                <span className="ml-1 text-[9px] bg-green-100 text-green-700 px-1 rounded">confirmed</span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="p-4">
            {/* Text tab */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <textarea
                  value={textDesc}
                  onChange={(e) => { setTextDesc(e.target.value); setTextSaved(false); }}
                  rows={5}
                  placeholder="Describe this screen — who uses it, what it does, what business problem it solves. Include anything the image doesn't show."
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{textDesc.length.toLocaleString()} characters</span>
                  <Button
                    size="sm"
                    onClick={handleSaveText}
                    disabled={savingText || textSaved}
                    variant={textSaved ? 'outline' : 'default'}
                    className={textSaved ? 'text-green-600 border-green-300 bg-green-50 hover:bg-green-50 cursor-default' : ''}
                  >
                    {savingText ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...</>
                    ) : textSaved ? (
                      <><Check className="h-3.5 w-3.5 mr-1" /> Saved</>
                    ) : (
                      <><Check className="h-3.5 w-3.5 mr-1" /> Save Description</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Audio tab */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                {/* Record button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={transcribing}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                      recording
                        ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                        : transcribing
                          ? 'bg-muted text-muted-foreground cursor-wait'
                          : 'bg-primary/10 text-primary hover:bg-primary/20',
                    )}
                  >
                    {transcribing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Transcribing...</>
                    ) : recording ? (
                      <><MicOff className="h-4 w-4" /> Stop Recording</>
                    ) : (
                      <><Mic className="h-4 w-4" /> Start Recording</>
                    )}
                  </button>
                  {recording && <span className="text-xs text-red-500 animate-pulse">Recording...</span>}
                </div>

                {/* Transcript display */}
                {transcript && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Transcript {audioConfirmed ? '(Confirmed)' : '(Review & edit)'}
                    </label>
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={4}
                      disabled={audioConfirmed}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40',
                        audioConfirmed ? 'bg-green-50 border-green-200 text-foreground' : 'bg-background border-input',
                      )}
                    />
                    {!audioConfirmed && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Review and edit the transcript, then confirm.</p>
                        <Button size="sm" onClick={handleConfirmTranscript} disabled={savingTranscript}>
                          {savingTranscript ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          Confirm Transcript
                        </Button>
                      </div>
                    )}
                    {audioConfirmed && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Transcript confirmed and saved
                      </p>
                    )}
                  </div>
                )}

                {!transcript && !recording && !transcribing && (
                  <p className="text-xs text-muted-foreground">
                    Click "Start Recording" and describe this screen verbally. The audio will be transcribed automatically.
                  </p>
                )}
              </div>
            )}

            {/* AI Formatted tab */}
            {activeTab === 'ai-formatted' && (
              <div className="space-y-4">
                {/* Generate button — only if raw transcript exists */}
                {!hasAudio && (
                  <div className="rounded-md border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Record an audio description first. The AI will format the raw transcript into professional documentation.
                    </p>
                  </div>
                )}

                {hasAudio && !aiFormatted && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      AI will restructure the raw transcript into clean, professional screen documentation
                      suitable for FRD, EPICs, and User Stories.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleAiFormat}
                      disabled={formatting}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {formatting ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Formatting...</>
                      ) : (
                        <><span className="mr-1">AI</span> Format Transcript</>
                      )}
                    </Button>
                  </div>
                )}

                {aiFormatted && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-blue-600">
                        AI Formatted Version {aiFormatConfirmed ? '(Confirmed)' : '(Review & edit)'}
                      </label>
                      {!aiFormatConfirmed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAiFormat}
                          disabled={formatting}
                          className="text-xs"
                        >
                          {formatting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          Re-generate
                        </Button>
                      )}
                    </div>
                    <textarea
                      value={aiFormatted}
                      onChange={(e) => setAiFormatted(e.target.value)}
                      rows={8}
                      disabled={aiFormatConfirmed}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/40',
                        aiFormatConfirmed
                          ? 'bg-blue-50 border-blue-200 text-foreground'
                          : 'bg-background border-blue-300',
                      )}
                    />
                    {!aiFormatConfirmed && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Review, edit if needed, then confirm. This version will be preferred for EPIC/User Story generation.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveAiTranscript(false)}
                            disabled={savingAiTranscript}
                          >
                            Save Draft
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveAiTranscript(true)}
                            disabled={savingAiTranscript}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {savingAiTranscript ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                            Confirm AI Version
                          </Button>
                        </div>
                      </div>
                    )}
                    {aiFormatConfirmed && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> AI-formatted transcript confirmed — this version will be used for EPIC and User Story generation
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
