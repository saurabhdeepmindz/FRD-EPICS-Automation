'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SectionReviewCard, type ReviewStatus } from '@/components/review/SectionReviewCard';
import { ReviewProgress } from '@/components/review/ReviewProgress';
import { SECTIONS } from '@/lib/section-config';
import { createPrd, updateSection } from '@/lib/api';
import { ArrowLeft, Check, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface SectionReview {
  sectionNumber: number;
  sectionName: string;
  content: Record<string, unknown>;
  status: ReviewStatus;
}

export default function ReviewPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<SectionReview[]>([]);
  const [prdCode, setPrdCode] = useState('');
  const [productName, setProductName] = useState('');
  const [clientName, setClientName] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load parsed sections from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('parsedSections');
    if (!stored) {
      router.push('/prd/new');
      return;
    }
    const parsed = JSON.parse(stored) as Record<string, Record<string, unknown>>;

    const reviewList: SectionReview[] = SECTIONS.map((s) => ({
      sectionNumber: s.number,
      sectionName: s.name,
      content: parsed[String(s.number)] ?? {},
      status: 'pending' as ReviewStatus,
    }));

    // Auto-detect productName from Section 1
    const s1 = parsed['1'];
    if (s1?.productName) setProductName(String(s1.productName));

    setReviews(reviewList);
  }, [router]);

  const handleAccept = useCallback((num: number) => {
    setReviews((prev) => prev.map((r) => (r.sectionNumber === num ? { ...r, status: 'accepted' } : r)));
  }, []);

  const handleEdit = useCallback((num: number, content: Record<string, unknown>) => {
    setReviews((prev) =>
      prev.map((r) => (r.sectionNumber === num ? { ...r, content, status: 'edited' } : r)),
    );
  }, []);

  const handleSkip = useCallback((num: number) => {
    setReviews((prev) => prev.map((r) => (r.sectionNumber === num ? { ...r, status: 'skipped' } : r)));
  }, []);

  const handleAcceptAll = useCallback(() => {
    setReviews((prev) =>
      prev.map((r) => (r.status === 'pending' ? { ...r, status: 'accepted' } : r)),
    );
  }, []);

  const accepted = reviews.filter((r) => r.status === 'accepted').length;
  const edited = reviews.filter((r) => r.status === 'edited').length;
  const skipped = reviews.filter((r) => r.status === 'skipped').length;
  const canCommit = prdCode.trim() !== '' && productName.trim() !== '' && (accepted + edited) > 0;

  const handleCommit = useCallback(async () => {
    if (!canCommit) return;
    setCommitting(true);
    setError(null);
    try {
      // Read source data from sessionStorage
      const sourceText = sessionStorage.getItem('prdSourceText') || undefined;
      const sourceFileName = sessionStorage.getItem('prdSourceFileName') || undefined;
      const sourceFileData = sessionStorage.getItem('prdSourceFileData') || undefined;

      // Create the PRD with source data
      const prd = await createPrd({
        prdCode: prdCode.trim(),
        productName: productName.trim(),
        clientName: clientName.trim() || undefined,
        submittedBy: submittedBy.trim() || undefined,
        sourceText,
        sourceFileName,
        sourceFileData,
      });

      // Update each accepted/edited section
      const sectionsToUpdate = reviews.filter((r) => r.status === 'accepted' || r.status === 'edited');
      for (const section of sectionsToUpdate) {
        await updateSection(prd.id, section.sectionNumber, section.content, true);
      }

      // Clean up sessionStorage
      sessionStorage.removeItem('parsedSections');
      sessionStorage.removeItem('parsedGaps');
      sessionStorage.removeItem('prdSourceText');
      sessionStorage.removeItem('prdSourceFileName');
      sessionStorage.removeItem('prdSourceFileData');

      // Redirect to editor
      router.push(`/prd/${prd.id}/edit`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create PRD';
      setError(msg);
    } finally {
      setCommitting(false);
    }
  }, [canCommit, prdCode, productName, reviews, router]);

  if (reviews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="review-page">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-card px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/prd/new">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Input
              </Link>
            </Button>
            <h1 className="text-sm font-semibold">PRD Draft Review</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAcceptAll} data-testid="btn-accept-all">
              <Check className="h-3.5 w-3.5 mr-1" />
              Accept All Pending
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Progress */}
        <ReviewProgress total={22} accepted={accepted} edited={edited} skipped={skipped} />

        {/* Mandatory fields warning */}
        {(!prdCode.trim() || !productName.trim()) && (accepted + edited) > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm" data-testid="mandatory-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Please fill in the required fields below before creating the PRD.
          </div>
        )}

        {/* PRD metadata */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-card">
          <div className="space-y-1">
            <label className="text-sm font-medium">PRD Code *</label>
            <input
              type="text"
              value={prdCode}
              onChange={(e) => setPrdCode(e.target.value)}
              placeholder="e.g., PRD-LSM001"
              className={`w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                !prdCode.trim() && (accepted + edited) > 0
                  ? 'border-amber-400 ring-1 ring-amber-300'
                  : 'border-input'
              }`}
              data-testid="review-prd-code"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Luggage Storage Marketplace"
              className={`w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                !productName.trim() && (accepted + edited) > 0
                  ? 'border-amber-400 ring-1 ring-amber-300'
                  : 'border-input'
              }`}
              data-testid="review-product-name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Acme Corp"
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="review-client-name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Submitted By</label>
            <input
              type="text"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="review-submitted-by"
            />
          </div>
        </div>

        {/* Section cards */}
        <div className="space-y-4">
          {reviews.map((r) => (
            <SectionReviewCard
              key={r.sectionNumber}
              sectionNumber={r.sectionNumber}
              sectionName={r.sectionName}
              content={r.content}
              status={r.status}
              onAccept={() => handleAccept(r.sectionNumber)}
              onEdit={(content) => handleEdit(r.sectionNumber, content)}
              onSkip={() => handleSkip(r.sectionNumber)}
            />
          ))}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Commit button */}
        <div className="sticky bottom-0 py-4 bg-background border-t border-border">
          <Button
            onClick={handleCommit}
            disabled={!canCommit || committing}
            className="w-full"
            size="lg"
            data-testid="btn-commit-prd"
          >
            {committing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating PRD...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Accept All & Create PRD ({accepted + edited} sections)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
