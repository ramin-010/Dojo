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

export function TriageInterceptor({ unverifiedBlocks: initialBlocks, onComplete }: TriageInterceptorProps) {
  const [blocks, setBlocks] = useState<UnverifiedBlock[]>(initialBlocks || []);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  if (!blocks || blocks.length === 0) {
    return null;
  }

  const handleVerify = async (id: string, status: SlotStatus) => {
    const remark = remarks[id] || '';
    
    setIsSubmitting(prev => ({ ...prev, [id]: true }));

    try {
      if (status === 'SKIPPED') {
        await skipSlot(id, remark.trim() || 'Skipped via Triage');
      } else {
        await completeSlot(id, remark.trim() || 'Completed via Triage', undefined);
      }

      const isLast = blocks.length === 1 && blocks[0].slot.id === id;
      
      setBlocks(prev => prev.filter(b => b.slot.id !== id));
      
      if (isLast) {
        onComplete();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update block. Please try again.');
    } finally {
      setIsSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleBulkVerify = async (status: SlotStatus) => {
    setIsBulkSubmitting(true);
    try {
      // Process sequentially to avoid DB lock issues or overwhelming the connection pool
      for (const block of blocks) {
        const id = block.slot.id;
        const remark = remarks[id] || '';
        if (status === 'SKIPPED') {
          await skipSlot(id, remark.trim() || 'Skipped via Triage');
        } else {
          await completeSlot(id, remark.trim() || 'Completed via Triage', undefined);
        }
      }
      setBlocks([]);
      onComplete();
    } catch (err) {
      console.error(err);
      alert('Failed to process some blocks. Please try again.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleDismiss = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      <div className="bg-sidebar border border-divider shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="p-5 flex items-start justify-between border-b border-divider/50 bg-gradient-to-r from-accent/5 to-transparent">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
               <AlertCircle className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-base font-bold text-foreground">Action Required</h2>
                <p className="text-xs text-foreground/50">
                  {blocks.length} unresolved {blocks.length === 1 ? 'block' : 'blocks'} from the past
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

        {/* Body - Scrollable List */}
        <div className="px-6 py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {blocks.map((item) => {
            const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            });
            const isProcessing = isSubmitting[item.slot.id] || isBulkSubmitting;

            return (
              <div key={item.slot.id} className="flex flex-col gap-3 p-4 bg-background/50 rounded-xl border border-divider/50 relative overflow-hidden group shrink-0">
                {isProcessing && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <span className="text-xs font-medium text-foreground/60 animate-pulse">Processing...</span>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-sidebar rounded text-foreground/50 border border-divider">
                        {formattedDate}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/50">
                        <Clock className="w-3 h-3 opacity-70" />
                        <span>{format12h(item.slot.startTime)} - {format12h(item.slot.endTime)}</span>
                      </div>
                    </div>
                    <div 
                      className="text-base font-bold truncate"
                      style={{ color: item.slot.color }}
                    >
                      {item.slot.title}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleVerify(item.slot.id, 'SKIPPED')}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-foreground/60 hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 font-medium text-xs border border-divider/50"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      Skip
                    </button>
                    <button
                      onClick={() => handleVerify(item.slot.id, 'COMPLETED')}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50 font-medium text-xs border border-accent/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Done
                    </button>
                  </div>
                </div>

                <div className="w-full">
                  <input
                    type="text"
                    placeholder="Add a remark (e.g. 'Was in deep work flow' or 'Slept in')..."
                    value={remarks[item.slot.id] || ''}
                    onChange={(e) => setRemarks(prev => ({ ...prev, [item.slot.id]: e.target.value }))}
                    className="w-full bg-sidebar border border-divider/50 hover:border-divider px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-accent transition-colors placeholder:text-foreground/30"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bulk Actions Footer */}
        {blocks.length > 1 && (
          <div className="p-5 flex gap-3 border-t border-divider/50 bg-sidebar/50">
            <button
              onClick={() => handleBulkVerify('SKIPPED')}
              disabled={isBulkSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-foreground/60 hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 font-semibold text-sm border border-divider/50 bg-background"
            >
              <SkipForward className="w-4 h-4" />
              Skip All Remaining
            </button>
            <button
              onClick={() => handleBulkVerify('COMPLETED')}
              disabled={isBulkSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 font-semibold text-sm shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark All Remaining Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
