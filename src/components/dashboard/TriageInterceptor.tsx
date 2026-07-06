'use client';

import { useState } from 'react';
import { X, CheckCircle2, SkipForward, AlertCircle, Clock } from 'lucide-react';
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

const format12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
};
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-sidebar border border-divider shadow-2xl rounded-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
               <AlertCircle className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-base font-bold text-foreground">Action Required</h2>
                <p className="text-xs text-foreground/50">
                  {unverifiedBlocks.length - currentIndex} unresolved {unverifiedBlocks.length - currentIndex === 1 ? 'block' : 'blocks'} from the past
                </p>
             </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1.5 text-foreground/30 hover:text-foreground hover:bg-hover rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-2 flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center text-center py-6 bg-background/50 rounded-xl border border-divider/50">
            <span className="text-xs font-semibold px-2 py-1 bg-background rounded text-foreground/50 border border-divider mb-3">
              {formattedDate}
            </span>
            <div 
              className="text-xl font-bold mb-1"
              style={{ color: currentItem.slot.color }}
            >
              {currentItem.slot.title}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/50 mt-0.5">
              <Clock className="w-3.5 h-3.5 opacity-70" />
              <span>{format12h(currentItem.slot.startTime)} - {format12h(currentItem.slot.endTime)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              placeholder="Add a remark (required if skipping)..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full bg-transparent border-b border-divider/50 hover:border-divider px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-foreground/30"
              disabled={isSubmitting}
            />
            {error && <p className="text-[10px] text-red-400 px-2">{error}</p>}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 flex gap-3">
          <button
            onClick={() => handleVerify('SKIPPED')}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-foreground/60 hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 font-semibold text-sm"
          >
            <SkipForward className="w-4 h-4" />
            Skip Block
          </button>
          <button
            onClick={() => handleVerify('COMPLETED')}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 font-semibold text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as Done
          </button>
        </div>
      </div>
    </div>
  );
}
