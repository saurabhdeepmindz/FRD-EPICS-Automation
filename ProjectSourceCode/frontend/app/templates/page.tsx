'use client';

import { Button } from '@/components/ui/button';
import { SECTIONS } from '@/lib/section-config';
import { SECTION_FIELDS } from '@/lib/section-fields';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function TemplatesPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto" data-testid="templates-page">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prd/new">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Create PRD
          </Link>
        </Button>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">PRD Template Guide</h1>
        </div>
        <p className="text-muted-foreground">
          Reference this guide while creating your PRD. Each section explains what information is expected
          and what fields you should fill in. Use this alongside the Conversational mode for best results.
        </p>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const fields = SECTION_FIELDS[section.number] ?? [];
          return (
            <div
              key={section.number}
              className="rounded-lg border border-border p-5 bg-card"
              id={`template-section-${section.number}`}
            >
              <h2 className="text-base font-semibold mb-1">
                Section {section.number} — {section.name}
              </h2>
              {section.subModules && (
                <p className="text-xs text-muted-foreground mb-3">
                  Sub-modules: {section.subModules.map((m) => m.label).join(', ')}
                </p>
              )}
              {fields.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {fields.map((field) => (
                    <div key={field.key} className="flex items-start gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {field.key}
                      </span>
                      <div>
                        <span className="text-sm font-medium">{field.label}</span>
                        {field.placeholder && (
                          <p className="text-xs text-muted-foreground mt-0.5">{field.placeholder}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Fields defined in sub-modules.</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
