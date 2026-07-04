'use client';

import { useState } from 'react';
import { CheckCircle2, SkipForward, Play, X, Loader2 } from 'lucide-react';
import { completeSlot, skipSlot, startEarly } from '@/app/actions/schedule-slot.actions';
import { SlotStatus } from '@prisma/client';

interface ActiveBlockActionsProps {
  currentSlot: {
    id: string;
    title: string;
    startTime: string; // original start
    endTime: string;   // original end
    status: SlotStatus;
  };
  isLast?: boolean;
  isNextUpcoming?: boolean; // true if this is the very next UPCOMING block
  onManageDay?: () => void;
}

type ActionMode = null | 'SKIP' | 'END_EARLY' | 'START_EARLY';

export function ActiveBlockActions({
  currentSlot,
  isLast,
  isNextUpcoming,
  onManageDay,
}: ActiveBlockActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [remark, setRemark] = useState('');

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getElapsedMinutes = (): number => {
    const now = new Date();
    const [sh, sm] = currentSlot.startTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    let currentMin = now.getHours() * 60 + now.getMinutes();
    if (currentMin < startMin) currentMin += 24 * 60; // midnight crossover
    return currentMin - startMin;
  };

  const getBlockDuration = (): number => {
    const [sh, sm] = currentSlot.startTime.split(':').map(Number);
    const [eh, em] = currentSlot.endTime.split(':').map(Number);
    let dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur <= 0) dur += 24 * 60;
    return dur;
  };

  const getRemainingMinutes = (): number => {
    return getBlockDuration() - getElapsedMinutes();
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Done — smart: if >15 min remaining, prompt for remark. Otherwise instant. */
  const handleDone = async () => {
    const remaining = getRemainingMinutes();
    if (remaining > 15) {
      // Needs remark — switch to END_EARLY inline input
      setActionMode('END_EARLY');
      return;
    }
    // Instant complete (includes negative remaining -> flow state)
    setIsSubmitting(true);
    try {
      await completeSlot(currentSlot.id);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false); // only reset on error, otherwise unmounts
    }
  };

  /** Submit END_EARLY with remark + minutesDone */
  const handleEndEarlySubmit = async () => {
    if (!remark.trim()) return;
    setIsSubmitting(true);
    try {
      const minutesDone = Math.max(0, getElapsedMinutes());
      await completeSlot(currentSlot.id, remark.trim(), minutesDone);
      handleCancel();
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  /** Skip with remark */
  const handleSkipSubmit = async () => {
    if (!remark.trim()) return;
    setIsSubmitting(true);
    try {
      await skipSlot(currentSlot.id, remark.trim());
      handleCancel();
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  /** Start Early with remark (or blank for default) */
  const handleStartEarlySubmit = async () => {
    setIsSubmitting(true);
    try {
      await startEarly(currentSlot.id, remark.trim() || undefined);
      handleCancel();
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  /** Cancel the action mode */
  const handleCancel = () => {
    setActionMode(null);
    setRemark('');
  };

  // ── Inline Remark Input (shared for SKIP, END_EARLY, START_EARLY) ──────────────
  if (actionMode === 'SKIP' || actionMode === 'END_EARLY' || actionMode === 'START_EARLY') {
    const isSkip = actionMode === 'SKIP';
    const isStartEarly = actionMode === 'START_EARLY';
    
    let placeholder = 'Remark...';
    if (isSkip) placeholder = 'Why skip?';
    else if (actionMode === 'END_EARLY') placeholder = 'Why end early?';
    else if (isStartEarly) placeholder = 'Optional remark...';

    const submitLabel = isSkip ? 'Skip' : isStartEarly ? 'Start' : 'End Early';
    const submitFn = isSkip ? handleSkipSubmit : isStartEarly ? handleStartEarlySubmit : handleEndEarlySubmit;
    const accentColor = isSkip ? 'text-foreground/70' : isStartEarly ? 'text-blue-500' : 'text-orange-500';
    
    // Start Early remark is optional
    const isSubmitDisabled = isSubmitting || (!isStartEarly && !remark.trim());

    return (
      <>
        <div className="fixed inset-0 z-40" onClick={handleCancel} />
        <div className={`absolute top-full mt-2 z-50 ${isLast ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
          <div className="flex items-center gap-1.5 bg-sidebar border border-divider/40 shadow-xl rounded-lg p-1 min-w-[240px] animate-in slide-in-from-top-1 fade-in duration-150 relative z-50">
            <input
              type="text"
              placeholder={placeholder}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSubmitDisabled) submitFn(); if (e.key === 'Escape') handleCancel(); }}
              className="bg-transparent border-none text-xs px-2 py-1 focus:outline-none flex-1 min-w-0 text-foreground placeholder:text-foreground/30"
              autoFocus
            />
            <button
              onClick={submitFn}
              disabled={isSubmitDisabled}
              className={`${accentColor} hover:bg-accent/10 px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-40 transition-colors whitespace-nowrap flex items-center justify-center min-w-[60px]`}
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : submitLabel}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Default Button Bar ────────────────────────────────────────────────────
  return (
    <div className={`absolute top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 ${isLast ? 'right-0' : 'left-0'}`}>
      <div className="flex items-center gap-0.5 bg-background/95 backdrop-blur border border-divider shadow-lg rounded-md p-0.5">
        
        {currentSlot.status === 'ACTIVE' && (
          <button
            onClick={handleDone}
            disabled={isSubmitting}
            title="Done"
            className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        )}

        {currentSlot.status === 'UPCOMING' && (
          <button
            onClick={() => {
              if (isNextUpcoming) {
                setActionMode('START_EARLY');
              } else if (onManageDay) {
                onManageDay();
              }
            }}
            disabled={isSubmitting}
            title={isNextUpcoming ? "Start Early" : "Manage Day"}
            className="p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Skip */}
        {(currentSlot.status === 'UPCOMING' || currentSlot.status === 'ACTIVE') && (
          <button
            onClick={() => setActionMode('SKIP')}
            disabled={isSubmitting}
            title="Skip Block"
            className="p-1 text-foreground/50 hover:text-foreground hover:bg-hover rounded transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
