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
      ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 shadow-sm cursor-pointer'
      : state === 'due'
      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
      : state === 'early'
      ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 shadow-sm cursor-pointer'
      : state === 'completed'
      ? 'bg-white/5 text-[#888888] opacity-50 cursor-not-allowed border border-white/5'
      : /* wait */
        'bg-white/5 text-[#888888] cursor-pointer border border-white/10 shadow-sm';

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