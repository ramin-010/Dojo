'use client';

import { useState } from 'react';
import { AlertTriangle, Check, SkipForward, X, Clock } from 'lucide-react';

interface UnresolvedBlock {
  id: string;
  blockTitle: string;
  blockColor: string;
  date: Date | string;
  scheduledStart: string;
  scheduledEnd: string;
}

interface TriageModalProps {
  isOpen: boolean;
  unresolvedBlocks: UnresolvedBlock[];
  onResolve: (logId: string, outcome: 'COMPLETED' | 'SKIPPED', remark?: string, remarkCategory?: string) => Promise<void>;
  onClose: () => void;
}

const REMARK_CATEGORIES = [
  { value: 'WORK_EMERGENCY', label: 'Work Emergency' },
  { value: 'MEETING', label: 'Unexpected Meeting' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'OTHER', label: 'Other' },
];

function format12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const blockDate = new Date(d);
  blockDate.setHours(0, 0, 0, 0);

  if (blockDate.getTime() === yesterday.getTime()) return 'Yesterday';
  if (blockDate.getTime() === today.getTime()) return 'Today';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface BlockResolution {
  outcome: 'COMPLETED' | 'SKIPPED' | null;
  remark: string;
  category: string;
}

export default function TriageModal({ isOpen, unresolvedBlocks, onResolve, onClose }: TriageModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, BlockResolution>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || unresolvedBlocks.length === 0) return null;

  const getResolution = (id: string): BlockResolution => 
    resolutions[id] || { outcome: null, remark: '', category: 'OTHER' };

  const updateResolution = (id: string, updates: Partial<BlockResolution>) => {
    setResolutions(prev => ({
      ...prev,
      [id]: { ...getResolution(id), ...updates },
    }));
  };

  const allResolved = unresolvedBlocks.every(b => getResolution(b.id).outcome !== null);

  const handleSubmitAll = async () => {
    setIsSubmitting(true);
    try {
      for (const block of unresolvedBlocks) {
        const res = getResolution(block.id);
        if (!res.outcome) continue;
        await onResolve(
          block.id,
          res.outcome,
          res.outcome === 'SKIPPED' ? res.remark || undefined : undefined,
          res.outcome === 'SKIPPED' ? res.category : undefined
        );
      }
      onClose();
    } catch (error) {
      console.error('Failed to resolve blocks:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group blocks by date
  const groupedByDate: Record<string, UnresolvedBlock[]> = {};
  unresolvedBlocks.forEach(b => {
    const key = formatDate(b.date);
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(b);
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
    >
      <div className="bg-background border border-divider/60 rounded-2xl w-full max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-divider/40">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-foreground">Schedule Check-In</h2>
              <p className="text-[12px] text-foreground/40">
                You have {unresolvedBlocks.length} unchecked schedule block{unresolvedBlocks.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {Object.entries(groupedByDate).map(([dateLabel, blocks]) => (
            <div key={dateLabel}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-3">{dateLabel}</p>
              <div className="space-y-3">
                {blocks.map(block => {
                  const res = getResolution(block.id);
                  return (
                    <div key={block.id} className="bg-sidebar border border-divider rounded-xl p-4">
                      {/* Block info */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: block.blockColor }} />
                        <span className="text-[14px] font-semibold text-foreground">{block.blockTitle}</span>
                        <span className="text-[11px] text-foreground/30 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format12h(block.scheduledStart)} — {format12h(block.scheduledEnd)}
                        </span>
                      </div>

                      {/* Resolution options */}
                      <div className="space-y-2">
                        <label 
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            res.outcome === 'COMPLETED' 
                              ? 'bg-emerald-500/10 border border-emerald-500/20' 
                              : 'hover:bg-hover border border-transparent'
                          }`}
                          onClick={() => updateResolution(block.id, { outcome: 'COMPLETED' })}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            res.outcome === 'COMPLETED' ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/20'
                          }`}>
                            {res.outcome === 'COMPLETED' && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-[13px] text-foreground/70">I did it, forgot to log</span>
                        </label>

                        <label 
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            res.outcome === 'SKIPPED' 
                              ? 'bg-amber-500/10 border border-amber-500/20' 
                              : 'hover:bg-hover border border-transparent'
                          }`}
                          onClick={() => updateResolution(block.id, { outcome: 'SKIPPED' })}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            res.outcome === 'SKIPPED' ? 'border-amber-500 bg-amber-500' : 'border-foreground/20'
                          }`}>
                            {res.outcome === 'SKIPPED' && <SkipForward className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-[13px] text-foreground/70">Skip & Log Reason</span>
                        </label>

                        {/* Remark input (shown when SKIPPED) */}
                        {res.outcome === 'SKIPPED' && (
                          <div className="ml-6 space-y-2 mt-1">
                            <select
                              value={res.category}
                              onChange={e => updateResolution(block.id, { category: e.target.value })}
                              className="w-full bg-background border border-divider rounded-md px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-accent"
                            >
                              {REMARK_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={res.remark}
                              onChange={e => updateResolution(block.id, { remark: e.target.value })}
                              placeholder="Brief remark..."
                              className="w-full bg-background border border-divider rounded-md px-3 py-1.5 text-[12px] text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-divider/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[13px] text-foreground/40 hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleSubmitAll}
            disabled={!allResolved || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-semibold disabled:opacity-40 hover:bg-accent/90 transition-colors"
          >
            {isSubmitting ? 'Saving...' : `Clear All (${unresolvedBlocks.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
