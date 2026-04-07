'use client';

import { useCallback, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { transcribeAudio } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MicButtonProps {
  onTranscribed: (text: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Find a supported MIME type for MediaRecorder */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    '',
  ];
  for (const t of types) {
    if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function MicButton({ onTranscribed, size = 'sm', className }: MicButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {};
      if (mimeType) options.mimeType = mimeType;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const blobType = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });

        if (blob.size < 100) {
          setError('Recording too short');
          return;
        }

        setTranscribing(true);
        try {
          const result = await transcribeAudio(blob);
          if (result.text.trim()) {
            onTranscribedRef.current(result.text.trim());
          } else {
            setError('No speech detected');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          setError(msg);
        } finally {
          setTranscribing(false);
        }
      };

      // Start with 250ms timeslice to get chunks during recording
      mediaRecorder.start(250);
      setRecording(true);
    } catch {
      setError('Mic access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const handleClick = useCallback(() => {
    if (transcribing) return;
    setError(null);
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, transcribing, startRecording, stopRecording]);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={transcribing}
        title={
          recording ? 'Click to stop recording'
            : transcribing ? 'Transcribing...'
            : 'Click to start voice input'
        }
        className={cn(
          'inline-flex items-center justify-center rounded-md transition-all',
          btnSize,
          recording
            ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
            : transcribing
              ? 'bg-muted text-muted-foreground cursor-wait'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
          className,
        )}
        data-testid="mic-button"
      >
        {transcribing ? (
          <Loader2 className={cn(iconSize, 'animate-spin')} />
        ) : recording ? (
          <MicOff className={iconSize} />
        ) : (
          <Mic className={iconSize} />
        )}
      </button>
      {recording && (
        <span className="text-[10px] text-red-500 font-medium animate-pulse">Recording...</span>
      )}
      {transcribing && (
        <span className="text-[10px] text-muted-foreground">Transcribing...</span>
      )}
      {error && (
        <span className="text-[10px] text-destructive">{error}</span>
      )}
    </div>
  );
}
