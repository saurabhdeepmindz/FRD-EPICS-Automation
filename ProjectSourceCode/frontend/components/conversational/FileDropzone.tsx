'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

const ACCEPTED = '.pdf,.docx,.md,.txt';
const MAX_SIZE = 20 * 1024 * 1024;

export function FileDropzone({ onFileSelect, selectedFile, onClear }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'docx', 'md', 'txt'].includes(ext ?? '')) {
        setError('Unsupported format. Please upload PDF, DOCX, MD, or TXT.');
        return;
      }
      if (file.size > MAX_SIZE) {
        setError(`File too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum is 20 MB.`);
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (selectedFile) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="file-selected">
        <FileText className="h-8 w-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button onClick={onClear} className="text-muted-foreground hover:text-destructive" data-testid="file-clear">
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        data-testid="file-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          className="sr-only"
        />
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">
          Drop a file here or <span className="text-primary">click to browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, MD, TXT — max 20 MB</p>
      </div>
      {error && <p className="text-sm text-destructive mt-2" data-testid="file-error">{error}</p>}
    </div>
  );
}
