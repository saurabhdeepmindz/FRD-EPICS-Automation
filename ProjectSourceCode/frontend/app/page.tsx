import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileText, Sparkles, Download } from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: '22-Section PRD Framework',
    description:
      'Guided forms for every section — from Overview and Scope to Success Criteria and Miscellaneous Requirements.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Suggestions',
    description:
      'OpenAI GPT automatically suggests content for any field you leave blank, keeping you moving forward.',
  },
  {
    icon: Download,
    title: 'Export to PDF',
    description:
      'Generate a professionally formatted PDF with a hyperlinked Table of Contents, ready for stakeholders.',
  },
];

export default function HomePage() {
  return (
    <main
      data-testid="home-page"
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8"
    >
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto mb-16" data-testid="hero-section">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
          <Sparkles className="h-4 w-4" />
          AI-Assisted PRD Creation
        </div>
        <h1
          className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6"
          data-testid="hero-heading"
        >
          PRD Generator
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Create complete, professional Product Requirements Documents in minutes. Guided 22-section
          framework with AI suggestions — built for Business Analysts and techno-functional teams.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" data-testid="cta-create-prd">
            <Link href="/prd/new">Create New PRD</Link>
          </Button>
          <Button asChild variant="outline" size="lg" data-testid="cta-view-prds">
            <Link href="/dashboard">View My PRDs</Link>
          </Button>
        </div>
      </section>

      {/* Feature cards */}
      <section
        className="grid gap-6 sm:grid-cols-1 md:grid-cols-3 max-w-5xl w-full mx-auto"
        data-testid="features-section"
      >
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                {feature.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Responsive breakpoint indicators — visible only in dev */}
      {process.env.NODE_ENV === 'development' && (
        <div
          className="fixed bottom-4 right-4 rounded-full bg-foreground text-background text-xs px-3 py-1 font-mono opacity-50 pointer-events-none"
          data-testid="breakpoint-indicator"
        >
          <span className="sm:hidden">xs</span>
          <span className="hidden sm:inline md:hidden">sm</span>
          <span className="hidden md:inline lg:hidden">md</span>
          <span className="hidden lg:inline xl:hidden">lg</span>
          <span className="hidden xl:inline">xl</span>
        </div>
      )}
    </main>
  );
}
