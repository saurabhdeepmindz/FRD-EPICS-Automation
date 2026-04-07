'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Bot, User, AlertCircle } from 'lucide-react';
import type { GapItem } from '@/lib/api';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

interface ChatAreaProps {
  gaps: GapItem[];
  onSendAnswers: (answers: string) => Promise<void>;
  onProceedToReview: () => void;
  loading: boolean;
  gapCount: number;
}

export function ChatArea({ gaps, onSendAnswers, onProceedToReview, loading, gapCount }: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build initial AI message from gaps
  useEffect(() => {
    if (gaps.length > 0 && messages.length === 0) {
      const gapText = gaps
        .map((g) => `**Section ${g.section}**: ${g.question}`)
        .join('\n\n');
      setMessages([
        {
          role: 'ai',
          content: `I've analysed your input and identified **${gaps.length} gaps** that need attention:\n\n${gapText}\n\nPlease provide answers to as many as you can. You can also skip and proceed to review.`,
        },
      ]);
    }
  }, [gaps, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    try {
      await onSendAnswers(userMsg);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    }
  }

  // Add new gap messages when gaps change (after gap-check response)
  useEffect(() => {
    if (gapCount === 0 && messages.length > 1) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'All gaps have been resolved! You can now proceed to review.' },
      ]);
    }
  }, [gapCount, messages.length]);

  return (
    <div className="flex flex-col border border-border rounded-lg bg-card overflow-hidden" data-testid="chat-area">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Gap Analysis</span>
        </div>
        <div className="flex items-center gap-3">
          {gapCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" data-testid="gap-badge">
              <AlertCircle className="h-3 w-3" />
              {gapCount} gaps
            </span>
          )}
          <Button size="sm" variant="outline" onClick={onProceedToReview} data-testid="btn-proceed-review">
            Proceed to Review
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`rounded-lg px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap ${
                msg.role === 'ai' ? 'bg-muted' : 'bg-primary text-primary-foreground'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2.5 text-sm text-muted-foreground">
              Analysing your answers...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type your answers here..."
          className="flex-1 rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          disabled={loading}
          data-testid="chat-input"
        />
        <Button size="sm" onClick={handleSend} disabled={!input.trim() || loading} data-testid="chat-send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
