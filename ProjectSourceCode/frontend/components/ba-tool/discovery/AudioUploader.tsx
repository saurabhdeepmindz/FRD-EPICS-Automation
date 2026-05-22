'use client';

import { useCallback, useRef, useState } from 'react';
import { Mic, Square, Upload, Loader2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  uploadDiscoveryAudio,
  transcribeDiscoveryAudio,
  deleteDiscoveryAudio,
  type BaAudioFile,
} from '@/lib/ba-api';

interface AudioUploaderProps {
  projectId: string;
  audioFiles: BaAudioFile[];
  onChanged: () => void;
}

const ACCEPTED_AUDIO_EXTS = '.opus,.m4a,.wav,.mp3,.flac,.aac,.webm,audio/*';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioUploader({ projectId, audioFiles, onChanged }: AudioUploaderProps) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadAndTranscribe = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const audio = await uploadDiscoveryAudio(projectId, file);
        onChanged();
        setActiveAudioId(audio.id);
        await transcribeDiscoveryAudio(projectId, audio.id);
        onChanged();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload or transcription failed';
        setError(msg);
      } finally {
        setBusy(false);
        setActiveAudioId(null);
      }
    },
    [projectId, onChanged],
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 100) {
          setError('Recording too short');
          return;
        }
        const ext = mimeType.includes('webm') ? 'webm' : 'audio';
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
        await uploadAndTranscribe(file);
      };

      recorder.start(250);
      setRecording(true);
    } catch {
      setError('Microphone access denied');
    }
  }, [uploadAndTranscribe]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const handleFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      for (const file of Array.from(files)) {
        if (file.size > MAX_AUDIO_BYTES) {
          setError(`${file.name} is larger than 25 MB — skipped`);
          continue;
        }
        await uploadAndTranscribe(file);
      }
      e.target.value = '';
    },
    [uploadAndTranscribe],
  );

  const handleDelete = useCallback(
    async (audioId: string) => {
      try {
        await deleteDiscoveryAudio(projectId, audioId);
        onChanged();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Delete failed';
        setError(msg);
      }
    },
    [projectId, onChanged],
  );

  const handleReTranscribe = useCallback(
    async (audioId: string) => {
      setBusy(true);
      setActiveAudioId(audioId);
      setError(null);
      try {
        await transcribeDiscoveryAudio(projectId, audioId);
        onChanged();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transcription failed';
        setError(msg);
      } finally {
        setBusy(false);
        setActiveAudioId(null);
      }
    },
    [projectId, onChanged],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Audio Input
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!recording ? (
              <Button
                type="button"
                onClick={startRecording}
                disabled={busy}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Mic className="h-4 w-4 mr-2" />
                Record from Mic
              </Button>
            ) : (
              <Button
                type="button"
                onClick={stopRecording}
                variant="destructive"
                className="animate-pulse"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}

            <span className="text-xs text-muted-foreground">— or —</span>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || recording}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Audio File(s)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AUDIO_EXTS}
              multiple
              onChange={handleFilePick}
              className="hidden"
            />

            {busy && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {activeAudioId ? 'Transcribing…' : 'Uploading…'}
              </div>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            Accepted: .opus .m4a .wav .mp3 .flac .aac .webm · Max 25 MB per file
          </div>

          {error && (
            <div className="mt-2 text-xs text-destructive flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Uploaded files ({audioFiles.length})
          </div>
          {audioFiles.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              No audio files yet. Record or upload to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {audioFiles.map((a) => (
                <AudioRow
                  key={a.id}
                  audio={a}
                  isActive={activeAudioId === a.id}
                  onDelete={() => handleDelete(a.id)}
                  onReTranscribe={() => handleReTranscribe(a.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AudioRowProps {
  audio: BaAudioFile;
  isActive: boolean;
  onDelete: () => void;
  onReTranscribe: () => void;
}

function AudioRow({ audio, isActive, onDelete, onReTranscribe }: AudioRowProps) {
  const statusBadge = (() => {
    switch (audio.status) {
      case 'TRANSCRIBED':
        return (
          <span className="text-[11px] text-green-600 dark:text-green-500 inline-flex items-center">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Transcribed
            {audio.sttProvider ? ` · ${audio.sttProvider}` : ''}
          </span>
        );
      case 'TRANSCRIBING':
        return (
          <span className="text-[11px] text-orange-500 inline-flex items-center">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Transcribing…
          </span>
        );
      case 'FAILED':
        return (
          <span className="text-[11px] text-destructive inline-flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      default:
        return <span className="text-[11px] text-muted-foreground">Uploaded</span>;
    }
  })();

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30',
        isActive && 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-mono truncate">📎 {audio.filename}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{formatBytes(audio.sizeBytes)}</span>
          {audio.detectedLang && <span>· {audio.detectedLang}</span>}
          {statusBadge}
        </div>
        {audio.errorMessage && (
          <div className="text-[11px] text-destructive mt-1 truncate" title={audio.errorMessage}>
            {audio.errorMessage}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {audio.status === 'FAILED' && (
          <Button type="button" size="sm" variant="ghost" onClick={onReTranscribe}>
            Retry
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
