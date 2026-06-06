'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Search, Library, FileText, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  listHldLibrary,
  searchHldLibrary,
  type HldLibraryEntry,
  type HldSimilarHit,
} from '@/lib/pipeline-api';

/**
 * HLD Library (Sprint v11 / HD-10) — org-wide browse + semantic search across all
 * indexed HLDs. Backed by the same embeddings/cosine retrieval as the Copilot.
 */
export default function HldLibraryPage() {
  const [entries, setEntries] = useState<HldLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<HldSimilarHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await listHldLibrary());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = async () => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchHldLibrary(query));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/ba-tool">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> BA Tool
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Library className="h-5 w-5 text-indigo-500" /> HLD Library
          </h1>
          <p className="text-sm text-gray-500">Browse &amp; semantically search every indexed High-Level Design across projects.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search across all HLDs — e.g. “multi-tenant isolation”, “event-driven payments”…"
              className="w-full text-sm border rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>
          <Button onClick={runSearch} disabled={searching || !q.trim()}>
            {searching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />} Search
          </Button>
          {results !== null && (
            <Button variant="outline" onClick={() => { setResults(null); setQ(''); }}>Clear</Button>
          )}
        </div>

        {/* Search results */}
        {results !== null ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{results.length} matching section{results.length === 1 ? '' : 's'}</p>
            {results.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-gray-400">No matches. Try different terms.</CardContent></Card>
            ) : (
              results.map((r, i) => (
                <Card key={i}>
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">{r.productName}</span>
                      <span className="text-[10px] uppercase tracking-wide bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">{r.sectionName}</span>
                      <span className="ml-auto text-[10px] text-gray-400">{(r.score * 100).toFixed(0)}% match</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-3">{r.snippet}</p>
                    <div className="mt-2">
                      <Link href={`/ba-tool/project/${r.projectId}/hld`} className="text-xs text-indigo-600 hover:underline">
                        Open HLD →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          // Browse list
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : entries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-2">
                  <Library className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">No HLDs indexed yet.</p>
                  <p className="text-xs text-gray-400">Generate an HLD (or click “Index this HLD” in the Copilot) to add it to the library.</p>
                </CardContent>
              </Card>
            ) : (
              entries.map((e) => (
                <Card key={e.hldId}>
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{e.productName}</p>
                      <p className="text-[11px] text-gray-400">
                        <Layers className="inline h-3 w-3 mr-0.5" /> {e.sections} sections · {e.chunks} chunks
                        {e.indexedAt ? ` · indexed ${new Date(e.indexedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <Link href={`/ba-tool/project/${e.projectId}/hld`} className="ml-auto text-xs text-indigo-600 hover:underline shrink-0">
                      Open →
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
