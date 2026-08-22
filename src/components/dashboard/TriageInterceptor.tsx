'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, SkipForward, AlertCircle, Clock, ChevronDown, ChevronUp, Battery, Target, Smile } from 'lucide-react';
import { triageSlot } from '@/app/actions/schedule-slot.actions';
import { saveDebrief, getDebriefForDate, SaveDebriefInput } from '@/app/actions/debrief.actions';
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

const DEFAULT_TAGS = [
  'Slept Well',
  'Slept Poorly',
  'Exercised',
  'Stressed',
  'Sick',
  'Social',
  'Distracted',
  'Deep Work',
  'Flow State',
  'Low Motivation'
];

interface TriageInterceptorProps {
  unverifiedBlocks: UnverifiedBlock[];
  workspaceId: string;
  onComplete: () => void;
}

export function TriageInterceptor({ unverifiedBlocks: initialBlocks, workspaceId, onComplete }: TriageInterceptorProps) {
  const [blocks, setBlocks] = useState<UnverifiedBlock[]>(initialBlocks || []);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // ── Context / Debrief State ────────────────────────────────────────────────
  const [showContext, setShowContext] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [narrative, setNarrative] = useState('');
  const [tomorrowIntent, setTomorrowIntent] = useState('');
  const [isLoadingDebrief, setIsLoadingDebrief] = useState(false);

  // Determine the target date for the debrief — most recent date from unresolved blocks
  const targetDate = useMemo(() => {
    if (!blocks || blocks.length === 0) return null;
    const dates = blocks.map(b => new Date(b.date).getTime());
    return new Date(Math.max(...dates));
  }, [blocks]);

  // Fetch existing debrief for the target date (pre-fill from Wrap Up Day)
  useEffect(() => {
    if (!targetDate || !workspaceId) return;

    let mounted = true;
    setIsLoadingDebrief(true);

    const fetchDebrief = async () => {
      try {
        const res = await getDebriefForDate(workspaceId, targetDate);
        if (mounted && res.success && res.debrief) {
          setEnergy(res.debrief.energy);
          setFocus(res.debrief.focus);
          setMood(res.debrief.mood);
          setSelectedTags(res.debrief.tags || []);
          setNarrative(res.debrief.narrative || '');
          setTomorrowIntent(res.debrief.tomorrowIntent || '');
          // Auto-expand if there's existing data
          if (res.debrief.energy || res.debrief.focus || res.debrief.mood || (res.debrief.tags && res.debrief.tags.length > 0) || res.debrief.narrative) {
            setShowContext(true);
          }
        }
      } catch (err) {
        console.error('Failed to load debrief for triage:', err);
      } finally {
        if (mounted) setIsLoadingDebrief(false);
      }
    };

    fetchDebrief();
    return () => { mounted = false; };
  }, [targetDate, workspaceId]);

  // Check if user has filled any context
  const hasContextData = energy !== null || focus !== null || mood !== null || selectedTags.length > 0 || narrative.trim() !== '' || tomorrowIntent.trim() !== '';

  // Save debrief context
  const saveContextDebrief = async () => {
    if (!hasContextData || !targetDate || !workspaceId) return;

    try {
      const input: SaveDebriefInput = {
        workspaceId,
        date: targetDate,
        blocksPlanned: initialBlocks.length,
        blocksCompleted: initialBlocks.length - blocks.length, // rough estimate
        blocksSkipped: 0,
        totalFocusedMin: 0,
        energy,
        focus,
        mood,
        tags: selectedTags,
        narrative: narrative.trim() || null,
        tomorrowIntent: tomorrowIntent.trim() || null,
      };

      await saveDebrief(input);
    } catch (err) {
      console.error('Failed to save debrief from triage:', err);
    }
  };

  if (!blocks || blocks.length === 0) {
    return null;
  }

  const handleVerify = async (id: string, status: SlotStatus) => {
    const remark = remarks[id] || '';
    
    setIsSubmitting(prev => ({ ...prev, [id]: true }));

    try {
      await triageSlot(id, status === 'SKIPPED' ? 'SKIPPED' : 'COMPLETED', remark.trim() || (status === 'SKIPPED' ? 'Skipped via Triage' : 'Completed via Triage'));

      const isLast = blocks.length === 1 && blocks[0].slot.id === id;
      
      setBlocks(prev => prev.filter(b => b.slot.id !== id));
      
      if (isLast) {
        await saveContextDebrief();
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
      for (const block of blocks) {
        const id = block.slot.id;
        const remark = remarks[id] || '';
        await triageSlot(id, status === 'SKIPPED' ? 'SKIPPED' : 'COMPLETED', remark.trim() || (status === 'SKIPPED' ? 'Skipped via Triage' : 'Completed via Triage'));
      }
      await saveContextDebrief();
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

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar">
      <div className="bg-sidebar border border-divider shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh]">
        
        {/* Header */}
        <div className="p-5 flex items-start justify-between border-b border-divider/50 bg-gradient-to-r from-accent/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
               <AlertCircle className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-base font-bold text-foreground">Action Required</h2>
                <p className="text-xs text-muted">
                  {blocks.length} unresolved {blocks.length === 1 ? 'block' : 'blocks'} from the past
                </p>
             </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1.5 text-muted hover:text-foreground hover:bg-hover rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Block List */}
          <div className="px-6 py-4 flex flex-col gap-4">
            {blocks.map((item) => {
              const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
              });
              const isProcessing = isSubmitting[item.slot.id] || isBulkSubmitting;

              return (
                <div key={item.slot.id} className="flex flex-col gap-3 p-4 bg-background/50 rounded-xl border border-divider/50 relative overflow-hidden group shrink-0">
                  {isProcessing && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                      <span className="text-xs font-medium text-muted animate-pulse">Processing...</span>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-sidebar rounded text-muted border border-divider">
                          {formattedDate}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                          <Clock className="w-3 h-3 opacity-70" />
                          <span>{format12h(item.slot.startTime)} - {format12h(item.slot.endTime)}</span>
                        </div>
                      </div>
                      <div className="text-base font-bold truncate text-foreground">
                        {item.slot.title}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleVerify(item.slot.id, 'SKIPPED')}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 font-medium text-xs border border-divider/50"
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
                      className="w-full bg-sidebar border border-divider/50 hover:border-divider px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Collapsible Context Section ──────────────────────────────────── */}
          <div className="px-6 pb-4">
            <button
              onClick={() => setShowContext(!showContext)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full py-2"
            >
              {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Add Context (Optional)
              {hasContextData && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                  Filled
                </span>
              )}
            </button>

            {showContext && (
              <div className="mt-3 flex flex-col gap-5 pt-4 border-t border-divider/30">
                {isLoadingDebrief ? (
                  <div className="py-6 flex items-center justify-center">
                    <span className="text-xs font-medium text-muted animate-pulse">Loading context...</span>
                  </div>
                ) : (
                  <>
                    {/* Structured Signals */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Structured Signals</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <RatingScale label="Energy" icon={<Battery className="w-4 h-4 text-emerald-400" />} value={energy} onChange={setEnergy} />
                        <RatingScale label="Focus" icon={<Target className="w-4 h-4 text-blue-400" />} value={focus} onChange={setFocus} />
                        <RatingScale label="Mood" icon={<Smile className="w-4 h-4 text-purple-400" />} value={mood} onChange={setMood} />
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="text-xs font-medium text-foreground/80 mb-2 block">Context Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_TAGS.map(tag => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => handleToggleTag(tag)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                isSelected
                                  ? 'bg-accent/10 border-accent/30 text-accent'
                                  : 'bg-background border-divider/40 text-foreground/80 hover:bg-hover hover:text-foreground'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Narrative */}
                    <div>
                      <label className="text-xs font-medium text-foreground/80 mb-2 block">
                        What&apos;s the story of that day? (Causal reasoning)
                      </label>
                      <textarea
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        placeholder="e.g., 'Woke up groggy, hit flow state in TS around 3pm. Skipped gym because I didn't want to lose context.'"
                        className="w-full bg-background border border-divider/40 rounded-xl p-3 text-sm text-foreground outline-none focus:border-accent/50 resize-none min-h-[70px]"
                      />
                    </div>

                    {/* Tomorrow Intent */}
                    <div>
                      <label className="text-xs font-medium text-foreground/80 mb-2 block">
                        What&apos;s the one thing you want to nail today? (Optional)
                      </label>
                      <input
                        type="text"
                        value={tomorrowIntent}
                        onChange={(e) => setTomorrowIntent(e.target.value)}
                        placeholder="e.g., 'Start with the gym before the brain kicks in'"
                        className="w-full bg-background border border-divider/40 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bulk Actions Footer */}
        {blocks.length > 1 && (
          <div className="p-5 flex gap-3 border-t border-divider/50 bg-sidebar/50 shrink-0">
            <button
              onClick={() => handleBulkVerify('SKIPPED')}
              disabled={isBulkSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-muted hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 font-semibold text-sm border border-divider/50 bg-background"
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function RatingScale({ label, icon, value, onChange }: { label: string, icon: React.ReactNode, value: number | null, onChange: (v: number) => void }) {
  return (
    <div className="bg-background border border-divider/40 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <span className="text-xs font-semibold text-foreground/80">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        {[1, 2, 3, 4, 5].map(num => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              value === num 
                ? 'bg-accent text-white shadow-sm scale-110' 
                : 'bg-divider/20 text-muted-foreground hover:bg-divider/50 hover:text-foreground'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}
