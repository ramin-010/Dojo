'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { shiftOrOverwriteBlock } from '@/app/actions/planner.actions';
import { useRouter } from 'next/navigation';

interface ReplaceBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBlock: any;
  targetDate: Date;
}

export function ReplaceBlockModal({ isOpen, onClose, targetBlock, targetDate }: ReplaceBlockModalProps) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (targetBlock) {
      setNewStartTime(targetBlock.startTime);
      setNewEndTime(targetBlock.endTime);
    }
  }, [targetBlock]);

  if (!isOpen || !targetBlock) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !remark.trim()) return;

    setIsSubmitting(true);
    try {
      await shiftOrOverwriteBlock(
        targetBlock.id,
        targetDate,
        newStartTime,
        newEndTime,
        newTitle,
        remark
      );
      
      setNewTitle('');
      setRemark('');
      
      router.refresh();
      onClose();
    } catch (err) {
      console.error('Failed to replace block', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-divider/60 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)] relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 p-2 bg-sidebar/80 backdrop-blur border border-divider rounded-full text-foreground/50 hover:text-foreground hover:bg-hover transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 border-b border-divider/40">
          <h2 className="text-xl font-bold text-foreground">Replace Block</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Overwrite <span className="font-semibold text-foreground/80">{targetBlock.title}</span> with a new one-off schedule.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">
              Reason for skipping {targetBlock.title}
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Hectic schedule, urgent meeting"
              className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div className="flex items-center justify-center py-2">
            <ArrowRight className="w-5 h-5 text-foreground/30" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">
              New Schedule Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Finish Pitch Deck"
              className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">Start Time</label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">End Time</label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !remark.trim() || !newTitle.trim()}
            className="w-full mt-4 bg-accent text-accent-foreground py-3 rounded-xl font-semibold transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Replacing...' : 'Replace Block'}
          </button>
        </form>
      </div>
    </div>
  );
}
