'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mic,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  FolderOpen,
  Plus,
  Trash2,
  Loader2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MicButton } from '@/components/forms/MicButton';
import {
  listCustomerInputs,
  createCustomerInput,
  deleteCustomerInput,
  reExtractCustomerInput,
  INPUT_TYPE_CATALOGUE,
  type CustomerInput,
  type CustomerInputType,
  type InputTypeMeta,
} from '@/lib/pipeline-api';

const TYPE_ICON: Record<CustomerInputType, typeof Mic> = {
  AUDIO: Mic,
  EXTERNAL_BRD: FileText,
  CUSTOMER_WIREFRAME: ImageIcon,
  TEXT_CONTEXT: MessageSquare,
  DOCUMENT: FolderOpen,
};

export default function CustomerInputsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [inputs, setInputs] = useState<CustomerInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<CustomerInputType | null>(null);
  const [reExtracting, setReExtracting] = useState<string | null>(null);
  const [reExtractError, setReExtractError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInputs(await listCustomerInputs(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (inputId: string) => {
    await deleteCustomerInput(projectId, inputId);
    await load();
  };

  const onReExtract = async (inputId: string) => {
    setReExtracting(inputId);
    setReExtractError((prev) => {
      const next = { ...prev };
      delete next[inputId];
      return next;
    });
    try {
      const result = await reExtractCustomerInput(projectId, inputId);
      if (result.chars === 0) {
        setReExtractError((prev) => ({
          ...prev,
          [inputId]: result.note ?? 'No text could be extracted from this file.',
        }));
      }
      await load();
    } catch (err) {
      setReExtractError((prev) => ({
        ...prev,
        [inputId]: err instanceof Error ? err.message : 'Re-extraction failed',
      }));
    } finally {
      setReExtracting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/ba-tool/project/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Project
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Customer Input Hub</h1>
          <p className="text-sm text-gray-500">
            Stage 1 · Collect all customer-provided inputs before generating PRD + FRD
          </p>
        </div>
        <div className="ml-auto">
          <Link href={`/ba-tool/project/${projectId}/project-prd`}>
            <Button size="sm" variant="outline">
              Next: PRD + FRD →
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Pipeline position */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <strong>Pipeline:</strong> <strong>Customer Inputs</strong> → PRD + FRD → Lo-fi Wireframes
          → Hi-fi → HLD → EPICs → Code
        </div>

        {/* Input type cards */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Add an Input
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INPUT_TYPE_CATALOGUE.map((meta) => (
              <AddInputCard
                key={meta.type}
                meta={meta}
                open={activeType === meta.type}
                onToggle={() =>
                  setActiveType((t) => (t === meta.type ? null : meta.type))
                }
                onAdded={async () => {
                  setActiveType(null);
                  await load();
                }}
                projectId={projectId}
              />
            ))}
          </div>
        </div>

        {/* Collected inputs */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Collected Inputs {inputs.length > 0 && `(${inputs.length})`}
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : inputs.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10 border border-dashed rounded-lg">
              No inputs yet. Add one above.
            </div>
          ) : (
            <div className="space-y-2">
              {inputs.map((input) => {
                const Icon = TYPE_ICON[input.inputType];
                const hasText = !!input.extractedText?.trim();
                // A file was uploaded but no usable text was extracted — this is
                // what blocks PRD generation. AUDIO is transcribed later, so skip it.
                const needsExtraction =
                  !!input.fileMetadata && !hasText && input.inputType !== 'AUDIO';
                const isReExtracting = reExtracting === input.id;
                const err = reExtractError[input.id];
                return (
                  <Card key={input.id}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {input.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {input.inputType.replace(/_/g, ' ')}
                          {input.fileMetadata?.fileName &&
                            ` · ${input.fileMetadata.fileName}`}
                          {hasText &&
                            ` · ${input.extractedText!.length.toLocaleString()} chars extracted`}
                        </p>
                        {hasText && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {input.extractedText!.slice(0, 200)}
                          </p>
                        )}
                        {needsExtraction && (
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                              <AlertTriangle className="h-3 w-3" />
                              No text extracted — won&apos;t be used for PRD
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => onReExtract(input.id)}
                              disabled={isReExtracting}
                            >
                              {isReExtracting ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Extracting…
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1" /> Re-extract
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => onDelete(input.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Input Card ──────────────────────────────────────────────────────────

interface AddInputCardProps {
  meta: InputTypeMeta;
  open: boolean;
  onToggle: () => void;
  onAdded: () => void | Promise<void>;
  projectId: string;
}

function AddInputCard({ meta, open, onToggle, onAdded, projectId }: AddInputCardProps) {
  const Icon = TYPE_ICON[meta.type];
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLabel('');
    setText('');
    setFiles([]);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (meta.file && files.length === 0) {
      setError(meta.multiple ? 'Please choose at least one file.' : 'Please choose a file.');
      return;
    }
    if (!meta.file && !text.trim()) {
      setError('Please enter some text.');
      return;
    }
    setSaving(true);
    try {
      if (meta.file) {
        // One CustomerInput per file — the backend stores a single file per input.
        // With several files, fall back to each file's own name as the label so
        // they stay distinguishable; a typed label only applies to a lone upload.
        for (const file of files) {
          await createCustomerInput(projectId, {
            inputType: meta.type,
            label: files.length === 1 ? label.trim() || undefined : undefined,
            file,
          });
        }
      } else {
        await createCustomerInput(projectId, {
          inputType: meta.type,
          label: label.trim() || undefined,
          text,
        });
      }
      reset();
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={open ? 'ring-2 ring-blue-200' : ''}>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-start gap-3 w-full text-left"
        >
          <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 text-sm">{meta.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
          </div>
          <Plus
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
              open ? 'rotate-45' : ''
            }`}
          />
        </button>

        {open && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="w-full text-sm border rounded px-2 py-1.5"
            />

            {meta.file ? (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={meta.accept}
                  multiple={meta.multiple}
                  className="hidden"
                  onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {files.length === 0
                    ? meta.multiple
                      ? 'Choose files'
                      : 'Choose file'
                    : files.length === 1
                      ? files[0].name
                      : `${files.length} files selected`}
                </Button>
                {files.length > 1 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="text-xs text-gray-500 truncate">
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type, paste, or narrate requirements / notes / context…"
                  rows={4}
                  className="flex-1 text-sm border rounded px-2 py-1.5 resize-y"
                />
                <MicButton
                  size="md"
                  onTranscribed={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
                />
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onToggle} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Add
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
