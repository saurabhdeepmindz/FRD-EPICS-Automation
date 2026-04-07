'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SubTabBarProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onSelect: (key: string) => void;
}

export function SubTabBar({ tabs, activeTab, onSelect }: SubTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkOverflow, { passive: true });
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkOverflow);
      observer.disconnect();
    };
  }, [checkOverflow, tabs]);

  // Scroll the active tab into view on mount / tab change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tab-key="${activeTab}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  if (tabs.length === 0) return null;

  return (
    <div
      data-testid="sub-tab-bar"
      className="relative flex items-center border-b border-border bg-muted/50"
    >
      {/* Left fade + arrow */}
      {showLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-r from-muted/90 via-muted/70 to-transparent hover:from-muted transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
      )}

      {/* Scrollable tabs */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            data-tab-key={tab.key}
            data-testid={`sub-tab-${tab.key}`}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors shrink-0',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Right fade + arrow */}
      {showRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-l from-muted/90 via-muted/70 to-transparent hover:from-muted transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}
    </div>
  );
}
