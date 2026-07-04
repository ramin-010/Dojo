'use client';

import { useState } from 'react';
import { X, Plane, Calendar } from 'lucide-react';
import { bulkPreSkip } from '@/app/actions/planner.actions';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';

interface VacationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VacationModal({ isOpen, onClose }: VacationModalProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [remark, setRemark] = useState('On Vacation');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remark.trim() || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      await bulkPreSkip(start, end, remark);
      router.refresh();
      onClose();
    } catch (err) {
      console.error('Failed to bulk pre-skip', err);
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

        <div className="p-6 border-b border-divider/40 flex flex-col items-center justify-center text-center bg-accent/5">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-4">
            <Plane className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Vacation Mode</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Pre-skip all schedule blocks between a given date range.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent [color-scheme:dark]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">
              Reason / Remark
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Vacation in Hawaii"
              className="w-full bg-sidebar border border-divider rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !remark.trim() || !startDate || !endDate}
            className="w-full mt-4 flex justify-center items-center gap-2 bg-accent text-accent-foreground py-3 rounded-xl font-semibold transition-opacity disabled:opacity-50"
          >
            <Calendar className="w-4 h-4" />
            {isSubmitting ? 'Skipping Blocks...' : 'Pre-Skip Blocks'}
          </button>
        </form>
      </div>
    </div>
  );
}
