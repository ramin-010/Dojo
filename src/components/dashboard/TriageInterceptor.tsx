'use client';

import { useState } from 'react';
import { X, CheckCircle2, SkipForward, AlertCircle } from 'lucide-react';
import { completeSlot, skipSlot } from '@/app/actions/schedule-slot.actions';
import { SlotStatus } from '@prisma/client';

export interface UnverifiedBlock {
  slot: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    color: string;
  };
  date: Date;
}

interface TriageInterceptorProps {
  unverifiedBlocks: UnverifiedBlock[];
  onComplete: () => void;
}

export function TriageInterceptor({ unverifiedBlocks, onComplete }: TriageInterceptorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!unverifiedBlocks || unverifiedBlocks.length === 0 || currentIndex >= unverifiedBlocks.length) {
    return null; // Don't render if nothing to verify
  }

  const currentItem = unverifiedBlocks[currentIndex];

  const handleVerify = async (status: SlotStatus) => {
    if (status === 'SKIPPED' && !remark.trim()) {
      setError('Please provide a reason for skipping this block.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (status === 'SKIPPED') {
        await skipSlot(currentItem.slot.id, remark.trim() || 'Skipped via Triage');
      } else {
        await completeSlot(currentItem.slot.id, remark.trim() || 'Completed via Triage', undefined);
      }

      setRemark('');
      
      if (currentIndex + 1 >= unverifiedBlocks.length) {
        onComplete();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      setError('Failed to update. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    if (currentIndex + 1 >= unverifiedBlocks.length) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const formattedDate = new Date(currentItem.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-sidebar border border-divider shadow-xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-divider flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">Action Required</h2>
            <p className="text-xs text-foreground/60">
              You have {unverifiedBlocks.length - currentIndex} unresolved {unverifiedBlocks.length - currentIndex === 1 ? 'block' : 'blocks'} from the past
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-2 text-foreground/40 hover:text-foreground hover:bg-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-2">
            <span className="text-xs font-medium px-2 py-1 bg-background rounded-md text-foreground/60 border border-divider">
              {formattedDate}
            </span>
            <div 
              className="text-lg font-bold px-3 py-1 rounded-md"
              style={{ color: currentItem.slot.color, backgroundColor: `${currentItem.slot.color}15` }}
            >
              {currentItem.slot.title}
            </div>
            <span className="text-xs font-mono text-foreground/50">
              {currentItem.slot.startTime} - {currentItem.slot.endTime}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Add a remark (required if skipping)..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full bg-background border border-divider rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
              disabled={isSubmitting}
            />
            {error && <p className="text-[10px] text-red-400">{error}</p>}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-background border-t border-divider grid grid-cols-2 gap-3">
          <button
            onClick={() => handleVerify('SKIPPED')}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-divider text-foreground/70 hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 font-medium text-sm"
          >
            <SkipForward className="w-4 h-4" />
            Skip Block
          </button>
          <button
            onClick={() => handleVerify('COMPLETED')}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 font-medium text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as Done
          </button>
        </div>
      </div>
    </div>
  );
}
