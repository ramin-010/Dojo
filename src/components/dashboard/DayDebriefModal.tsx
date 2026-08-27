'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Battery, Target, Smile, ChevronDown, ChevronUp, Loader2, Save, BrainCircuit, CheckCircle2, XCircle, Clock, CircleDashed } from 'lucide-react';
import { saveDebrief, getDebriefForDate, SaveDebriefInput, SlotLogInput } from '@/app/actions/debrief.actions';
import { ScheduleSlotProp } from '@/app/(protected)/dashboard/DashboardClient';
import { toast } from 'sonner';
import { SlotStatus } from '@prisma/client';

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

interface DayDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  todaySlots: ScheduleSlotProp[];
  date?: Date;
  title?: string;
  subtitle?: string;
}

export function DayDebriefModal({
  isOpen,
  onClose,
  workspaceId,
  todaySlots,
  date = new Date(),
  title = "Daily Debrief — AI Context",
  subtitle = 'Log your blocks and help your AI mentor understand the "why".'
}: DayDebriefModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showFreeWrite, setShowFreeWrite] = useState(false);

  // New: Schedule Review State
  const [slotLogs, setSlotLogs] = useState<Record<string, SlotLogInput>>({});

  // Initialize slotLogs when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialLogs: Record<string, SlotLogInput> = {};
      todaySlots.forEach(s => {
        initialLogs[s.id] = {
          slotId: s.id,
          sourceBlockId: s.sourceBlockId,
          // Keep current status so it remains unmarked if UPCOMING
          status: s.status as SlotStatus,
          remark: s.remark || '',
          minutesDone: s.minutesDone || null,
          actualStartTime: s.actualStartTime,
          actualEndTime: s.actualEndTime,
        };
      });
      setSlotLogs(initialLogs);
    }
  }, [isOpen, todaySlots]);

  // Auto-Stats (Layer 1) - Now reactive to slotLogs
  const stats = useMemo(() => {
    const logsArray = Object.values(slotLogs);
    
    const planned = todaySlots.length;
    const completed = logsArray.filter(l => l.status === 'COMPLETED' || l.status === 'PARTIAL').length;
    const skipped = logsArray.filter(l => l.status === 'SKIPPED').length;
    
    let totalMin = 0;
    logsArray.forEach(log => {
      if (log.status === 'COMPLETED' || log.status === 'PARTIAL') {
        if (log.minutesDone) {
          totalMin += log.minutesDone;
        } else {
          // Fallback: calculate from start/end
          const slot = todaySlots.find(s => s.id === log.slotId);
          if (slot) {
            const [sh, sm] = (log.actualStartTime || slot.startTime).split(':').map(Number);
            const [eh, em] = (log.actualEndTime || slot.endTime).split(':').map(Number);
            let dur = (eh * 60 + em) - (sh * 60 + sm);
            if (dur < 0) dur += 24 * 60;
            totalMin += dur;
          }
        }
      }
    });

    return {
      planned,
      completed,
      skipped,
      remaining: planned - completed - skipped,
      focusedMin: totalMin,
      focusedHrs: (totalMin / 60).toFixed(1)
    };
  }, [slotLogs, todaySlots]);

  // Form State (Layer 2 & 3)
  const [energy, setEnergy] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [narrative, setNarrative] = useState('');
  const [tomorrowIntent, setTomorrowIntent] = useState('');
  const [freeWrite, setFreeWrite] = useState('');

  // Fetch existing debrief
  useEffect(() => {
    if (!isOpen) return;
    
    let mounted = true;
    setIsLoading(true);
    
    const fetchDebrief = async () => {
      const res = await getDebriefForDate(workspaceId, date);
      if (mounted) {
        if (res.success && res.debrief) {
          setEnergy(res.debrief.energy);
          setFocus(res.debrief.focus);
          setMood(res.debrief.mood);
          setSelectedTags(res.debrief.tags || []);
          setNarrative(res.debrief.narrative || '');
          setTomorrowIntent(res.debrief.tomorrowIntent || '');
          setFreeWrite(res.debrief.freeWrite || '');
          if (res.debrief.freeWrite) setShowFreeWrite(true);
        }
        setIsLoading(false);
      }
    };
    
    fetchDebrief();
    return () => { mounted = false; };
  }, [isOpen, workspaceId, date]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSlotStatusChange = (slotId: string, status: SlotStatus) => {
    setSlotLogs(prev => ({
      ...prev,
      [slotId]: { ...prev[slotId], status }
    }));
  };

  const handleSlotRemarkChange = (slotId: string, remark: string) => {
    setSlotLogs(prev => ({
      ...prev,
      [slotId]: { ...prev[slotId], remark }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const input: SaveDebriefInput = {
      workspaceId,
      date,
      blocksPlanned: stats.planned,
      blocksCompleted: stats.completed,
      blocksSkipped: stats.skipped,
      totalFocusedMin: stats.focusedMin,
      energy,
      focus,
      mood,
      tags: selectedTags,
      narrative: narrative.trim() || null,
      tomorrowIntent: tomorrowIntent.trim() || null,
      freeWrite: freeWrite.trim() || null,
      slotLogs: Object.values(slotLogs),
    };

    const res = await saveDebrief(input);
    setIsSaving(false);
    
    if (res.success) {
      toast.success('Day debrief saved');
      onClose();
    } else {
      toast.error('Failed to save debrief');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-sidebar border border-divider shadow-2xl rounded-2xl flex flex-col my-auto relative max-h-[95vh] sm:max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-divider/50 bg-gradient-to-r from-accent/10 to-transparent rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-accent" />
                {title}
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1">
                {subtitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-foreground/40 hover:text-foreground hover:bg-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <span className="text-sm font-medium text-foreground/50">Loading context...</span>
              </div>
            ) : (
              <>
                {/* Layer 0: Schedule Review */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Schedule Review</h3>
                  {todaySlots.length === 0 ? (
                    <div className="bg-background border border-divider/40 rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground">No blocks scheduled for today.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {todaySlots.map((slot) => {
                        const log = slotLogs[slot.id];
                        if (!log) return null;

                        return (
                          <div key={slot.id} className="bg-background border border-divider/40 rounded-xl p-3 flex flex-col gap-3">
                            {/* Top row: Info and Actions */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: slot.color }} />
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-foreground truncate">{slot.title}</h4>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>{slot.startTime} - {slot.endTime}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center shrink-0">
                                <div className="flex bg-sidebar rounded-lg p-0.5 border border-divider/50">
                                  <button
                                    onClick={() => handleSlotStatusChange(slot.id, 'UPCOMING')}
                                    className={`p-1.5 rounded-md transition-colors ${log.status !== 'COMPLETED' && log.status !== 'SKIPPED' ? 'bg-accent/10 text-accent' : 'text-foreground/30 hover:text-foreground/70 hover:bg-hover'}`}
                                    title="Unmarked"
                                  >
                                    <CircleDashed className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleSlotStatusChange(slot.id, 'COMPLETED')}
                                    className={`p-1.5 rounded-md transition-colors ${log.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'text-foreground/30 hover:text-foreground/70 hover:bg-hover'}`}
                                    title="Completed"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleSlotStatusChange(slot.id, 'SKIPPED')}
                                    className={`p-1.5 rounded-md transition-colors ${log.status === 'SKIPPED' ? 'bg-red-500/10 text-red-500' : 'text-foreground/30 hover:text-foreground/70 hover:bg-hover'}`}
                                    title="Skipped"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Bottom row: Input */}
                            <div className="pl-5">
                              <input
                                type="text"
                                placeholder="Add a note for this block..."
                                value={log.remark || ''}
                                onChange={(e) => handleSlotRemarkChange(slot.id, e.target.value)}
                                className="w-full bg-sidebar border border-divider/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-accent transition-colors"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Layer 1: Auto-Context (Read Only) */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Today's Stats</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-background border border-divider/40 rounded-xl p-3">
                      <span className="block text-xl font-bold text-foreground">{stats.completed}/{stats.planned}</span>
                      <span className="text-[11px] font-medium text-muted-foreground mt-0.5">Blocks Done</span>
                    </div>
                    <div className="bg-background border border-divider/40 rounded-xl p-3">
                      <span className="block text-xl font-bold text-foreground">{stats.focusedHrs}h</span>
                      <span className="text-[11px] font-medium text-muted-foreground mt-0.5">Focused Time</span>
                    </div>
                    <div className="bg-background border border-divider/40 rounded-xl p-3">
                      <span className="block text-xl font-bold text-foreground">{stats.skipped}</span>
                      <span className="text-[11px] font-medium text-muted-foreground mt-0.5">Skipped</span>
                    </div>
                  </div>
                </section>

                {/* Layer 2: Structured Signals */}
                <section className="flex flex-col gap-6">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Structured Signals</h3>
                  
                  {/* Ratings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <RatingScale label="Energy" icon={<Battery className="w-4 h-4 text-emerald-400" />} value={energy} onChange={setEnergy} />
                    <RatingScale label="Focus" icon={<Target className="w-4 h-4 text-blue-400" />} value={focus} onChange={setFocus} />
                    <RatingScale label="Mood" icon={<Smile className="w-4 h-4 text-purple-400" />} value={mood} onChange={setMood} />
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
                      What's the story of today? (Causal reasoning)
                    </label>
                    <textarea
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                      placeholder="e.g., 'Woke up groggy, hit flow state in TS around 3pm. Skipped gym because I didn't want to lose context.'"
                      className="w-full bg-background border border-divider/40 rounded-xl p-3 text-sm text-foreground outline-none focus:border-accent/50 resize-none min-h-[80px]"
                    />
                  </div>

                  {/* Intention */}
                  <div>
                    <label className="text-xs font-medium text-foreground/80 mb-2 block">
                      What's the one thing you want to nail tomorrow? (Optional)
                    </label>
                    <input
                      type="text"
                      value={tomorrowIntent}
                      onChange={(e) => setTomorrowIntent(e.target.value)}
                      placeholder="e.g., 'Start with the gym before the brain kicks in'"
                      className="w-full bg-background border border-divider/40 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
                    />
                  </div>
                </section>

                {/* Layer 3: Free Write */}
                <section className="pt-2 border-t border-divider/30">
                  <button
                    onClick={() => setShowFreeWrite(!showFreeWrite)}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showFreeWrite ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Want to add more? (Unstructured Free-write)
                  </button>
                  
                  <AnimatePresence>
                    {showFreeWrite && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <textarea
                          value={freeWrite}
                          onChange={(e) => setFreeWrite(e.target.value)}
                          placeholder="Dump your messy thoughts here. No structure needed. Good for your brain, but the AI doesn't rely on it."
                          className="w-full bg-background border border-divider/40 rounded-xl p-3 text-sm text-foreground outline-none focus:border-accent/50 resize-none min-h-[150px]"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-divider/50 bg-sidebar rounded-b-2xl flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              This data trains your Weekly Mentor Report
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Debrief
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Helpers

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
