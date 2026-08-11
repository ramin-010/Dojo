// Place this file at:  src/app/topic/[id]/components/RevisionButton.tsx
'use client';

import React from 'react';
import { Calendar, CheckCircle2, PlayCircle, Loader2 } from 'lucide-react';
import { RevisionButtonState } from '../types';

interface RevisionButtonProps {
  state: RevisionButtonState;
  text: string;
  isPending: boolean;
  onClick: () => void;
}

export function RevisionButton({
  state,
  text,
  isPending,
  onClick,
}: RevisionButtonProps) {
  const isDisabled =
    isPending || state === 'completed' || state === 'wait';

  const colorClass =
    state === 'start'
      ? 'bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 shadow-sm cursor-pointer'
      : state === 'due'
      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
      : state === 'early'
      ? 'bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 shadow-sm cursor-pointer'
      : state === 'completed'
      ? 'bg-foreground/5 text-muted opacity-50 cursor-not-allowed border border-border'
      : /* wait */
        'bg-foreground/5 text-muted cursor-pointer border border-border shadow-sm';

  const Icon = isPending
    ? () => <Loader2 className="w-3.5 h-3.5 animate-spin" />
    : state === 'start'
    ? () => <PlayCircle className="w-3.5 h-3.5" />
    : state === 'wait'
    ? () => <Calendar className="w-3.5 h-3.5" />
    : () => <CheckCircle2 className="w-3.5 h-3.5" />;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 ${colorClass}`}
    >
      <Icon />
      {text}
    </button>
  );
}