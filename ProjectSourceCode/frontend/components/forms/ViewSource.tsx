'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSource, type PrdSource } from '@/lib/api';
import { FileText, X, Loader2, Download, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViewSourceProps {
  prdId: string;
}

export function ViewSource({ prdId }: ViewSourceProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<PrdSource | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSource = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSource(prdId);
      setSource(data);
    } catch {
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [prdId]);

  useEffect(() => {
    if (open && !source) fetchSource();
  }, [open, source, fetchSource]);

  const hasSource = source && (source.sourceText || source.sourceFileData);

  const handleDownloadFile = useCallback(() => {
    if (!source?.sourceFileData || !source?.sourceFileName) return;
    const a = document.createElement('a');
    a.href = source.sourceFileData;
    a.download = source.sourceFileName;
    a.click();
  }, [source]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="View original source input"
        data-testid="btn-view-source"
      >
        <FileText className="h-4 w-4 mr-1" />
        Source
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="source-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Original Source Input</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loading && !hasSource && (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No source document was saved for this PRD.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Source is only stored when creating a PRD via the Conversational flow.
                  </p>
                </div>
              )}

              {!loading && hasSource && (
                <div className="space-y-4">
                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {source.sourceFileName && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="font-medium">{source.sourceFileName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Uploaded: {new Date(source.createdAt).toLocaleString()}</span>
                    </div>
                    {source.sourceText && (
                      <span>{source.sourceText.length.toLocaleString()} characters</span>
                    )}
                  </div>

                  {/* Download button for file */}
                  {source.sourceFileData && source.sourceFileName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadFile}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download Original File
                    </Button>
                  )}

                  {/* Original text */}
                  {source.sourceText && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">
                        Original Text
                      </label>
                      <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[50vh] overflow-y-auto">
                        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                          {source.sourceText}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
