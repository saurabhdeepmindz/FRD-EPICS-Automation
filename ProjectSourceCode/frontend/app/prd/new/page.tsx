'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ConversationalTab } from '@/components/conversational/ConversationalTab';
import { createPrd } from '@/lib/api';
import type { GapItem } from '@/lib/api';
import { Loader2, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Tab = 'structured' | 'conversational';

export default function NewPrdPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('conversational');

  // ── Structured form state (v1) ──
  const [prdCode, setPrdCode] = useState('');
  const [productName, setProductName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [author, setAuthor] = useState('');
  const [clientName, setClientName] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = prdCode.trim() !== '' && productName.trim() !== '';

  async function handleCreate() {
    if (!canSubmit) return;
    setCreating(true);
    setError(null);
    try {
      const prd = await createPrd({
        prdCode: prdCode.trim(),
        productName: productName.trim(),
        version: version.trim() || undefined,
        author: author.trim() || undefined,
        clientName: clientName.trim() || undefined,
        submittedBy: submittedBy.trim() || undefined,
      });
      router.push(`/prd/${prd.id}/edit`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create PRD';
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  // ── Conversational handler ──
  const handleParsed = useCallback(
    (sections: Record<string, Record<string, string>>, gaps: GapItem[]) => {
      // Store in sessionStorage and navigate to review page
      sessionStorage.setItem('parsedSections', JSON.stringify(sections));
      sessionStorage.setItem('parsedGaps', JSON.stringify(gaps));
      router.push('/prd/new/review');
    },
    [router],
  );

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" data-testid="new-prd-page">
      <div className="max-w-2xl mx-auto">
        {/* Tab selector */}
        <div className="flex items-center gap-1 mb-6 rounded-lg border border-border p-1 bg-muted/50" data-testid="creation-tabs">
          <button
            onClick={() => setActiveTab('structured')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'structured'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid="tab-structured"
          >
            <FileText className="h-4 w-4" />
            Structured Form
          </button>
          <button
            onClick={() => setActiveTab('conversational')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'conversational'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid="tab-conversational"
          >
            <MessageSquare className="h-4 w-4" />
            Conversational
          </button>
        </div>

        {/* Structured form tab (v1 — preserved) */}
        {activeTab === 'structured' && (
          <Card data-testid="new-prd-form">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Create New PRD</CardTitle>
              <CardDescription>
                Start a new Product Requirements Document. All 22 sections will be initialised for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">PRD Code *</label>
                <input
                  type="text"
                  value={prdCode}
                  onChange={(e) => setPrdCode(e.target.value)}
                  placeholder="e.g., PRD-LSM001"
                  maxLength={50}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-prd-code"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Product Name *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Luggage Storage Marketplace"
                  maxLength={200}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                  maxLength={20}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-version"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-author"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  maxLength={200}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Submitted By</label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  placeholder="e.g., John Smith, VP Engineering"
                  maxLength={200}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-submitted-by"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" data-testid="create-error">{error}</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href="/">Cancel</Link>
              </Button>
              <Button onClick={handleCreate} disabled={!canSubmit || creating} data-testid="btn-create-prd">
                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create PRD
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Conversational tab (v2 — new) */}
        {activeTab === 'conversational' && (
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Create PRD from Requirements</CardTitle>
              <CardDescription>
                Paste your meeting notes, upload a document, or describe your product idea. AI will create a structured PRD draft for you to review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConversationalTab onParsed={handleParsed} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
