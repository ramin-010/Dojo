'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, XCircle, Loader2, Battery, Target, Smile, MessageSquare } from 'lucide-react';
import { saveMultiDayCatchUp } from '@/app/actions/debrief.actions';
import { toast } from 'sonner';

interface MultiDayCatchUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  blocksByDate: Record<string, Array<{
    id: string;
    sourceBlockId: string | null;
    title: string;
    startTime: string;
    endTime: string;
    color: string;
  }>>;
}

const CONTEXT_TAGS = [
  'Slept Well', 'Slept Poorly', 'Exercised', 'Stressed', 'Sick', 'Social',
  'Distracted', 'Deep Work', 'Flow State', 'Low Motivation', 'High Motivation',
  'Tired', 'Burnout', 'Family Time', 'Errands', 'Hydrated', 'Caffeine Crash'
];

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

/** A block is unmarked until the user says otherwise. */
type SlotDecision = 'COMPLETED' | 'SKIPPED' | 'UNRESOLVED';

export function MultiDayCatchUpModal({ isOpen, onClose, workspaceId, blocksByDate }: MultiDayCatchUpModalProps) {
  const [narrative, setNarrative] = useState('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  
  // 'UNRESOLVED' is a first-class state: a block nobody marked stays unmarked.
  // Defaulting to SKIPPED here is what silently wrote phantom skips for every
  // block the user never touched.
  const [slotUpdates, setSlotUpdates] = useState<Record<string, { sourceBlockId: string | null; status: SlotDecision; remark: string }>>({});
  const [showRemark, setShowRemark] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialUpdates: Record<string, { sourceBlockId: string | null; status: SlotDecision; remark: string }> = {};
      Object.values(blocksByDate).flat().forEach(block => {
        initialUpdates[block.id] = { sourceBlockId: block.sourceBlockId, status: 'UNRESOLVED', remark: '' };
      });
      setSlotUpdates(initialUpdates);
      setNarrative('');
      setEnergy(null);
      setFocus(null);
      setMood(null);
      setTags([]);
      setShowRemark({});
    }
  }, [isOpen, blocksByDate]);

  const dates = Object.keys(blocksByDate).sort();
  const dateRangeText = dates.length > 0 
    ? `Catch up on ${new Date(dates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  const canSave = energy !== null && focus !== null && mood !== null && narrative.trim().length > 0;

  const unresolvedCount = Object.values(slotUpdates).filter(u => u.status === 'UNRESOLVED').length;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    
    try {
      // Send ONLY blocks the user explicitly decided. Anything left
      // UNRESOLVED keeps its UPCOMING status in the database rather than
      // being invented as a skip.
      const formattedSlotUpdates = Object.entries(slotUpdates)
        .filter(([, update]) => update.status !== 'UNRESOLVED')
        .map(([slotId, update]) => ({
          slotId,
          sourceBlockId: update.sourceBlockId,
          status: update.status as 'COMPLETED' | 'SKIPPED',
          ...(update.remark.trim() ? { remark: update.remark.trim() } : {})
        }));

      await saveMultiDayCatchUp({
        workspaceId,
        dates,
        sharedContext: {
          energy,
          focus,
          mood,
          tags,
          narrative: narrative.trim()
        },
        slotUpdates: formattedSlotUpdates
      });
      
      toast.success('Catch-up saved!');
      onClose();
    } catch (error) {
      console.error('Failed to save catch-up:', error);
      toast.error('Failed to save catch-up. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    setTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleMarkAllSkipped = () => {
    setSlotUpdates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id] = { ...next[id], status: 'SKIPPED' };
      });
      return next;
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/30 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl bg-sidebar border border-divider shadow-2xl rounded-2xl flex flex-col max-h-[95vh] sm:max-h-[92vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-divider flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-purple-500" />
                  Welcome Back
                </h2>
                {dateRangeText && (
                  <p className="text-sm text-muted-foreground mt-1 ml-8">{dateRangeText}</p>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 custom-scrollbar p-6 space-y-8">
              
              {/* Section 1: Shared Context */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">What happened during this time? <span className="text-red-500">*</span></label>
                  <textarea
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                    placeholder="Briefly describe why you were away or what you were focusing on..."
                    className="w-full bg-background border border-divider/40 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none h-24"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <RatingScale
                    label="Energy"
                    icon={<Battery className="w-4 h-4 text-emerald-500" />}
                    value={energy}
                    onChange={setEnergy}
                  />
                  <RatingScale
                    label="Focus"
                    icon={<Target className="w-4 h-4 text-blue-500" />}
                    value={focus}
                    onChange={setFocus}
                  />
                  <RatingScale
                    label="Mood"
                    icon={<Smile className="w-4 h-4 text-purple-500" />}
                    value={mood}
                    onChange={setMood}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Context Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {CONTEXT_TAGS.map(tag => {
                      const isSelected = tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => handleToggleTag(tag)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                            isSelected 
                              ? 'bg-accent/10 border-accent/20 text-accent' 
                              : 'bg-background border-divider/40 text-muted-foreground hover:border-divider hover:text-foreground'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 2: Missed Days Summary */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold border-b border-divider pb-2">Missed Schedule</h3>
                
                {dates.map(dateStr => {
                  const dayBlocks = blocksByDate[dateStr];
                  if (!dayBlocks || dayBlocks.length === 0) return null;
                  
                  return (
                    <div key={dateStr} className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h4>
                      <div className="space-y-2">
                        {dayBlocks.map(block => {
                          const update = slotUpdates[block.id];
                          if (!update) return null;

                          return (
                            <div key={block.id} className="bg-background border border-divider/40 rounded-xl overflow-hidden flex flex-col transition-colors hover:border-divider">
                              <div className="flex items-center p-3">
                                <div className="w-1.5 h-10 rounded-full mr-3" style={{ backgroundColor: block.color || '#94a3b8' }} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{block.title}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 ml-4">
                                  <button
                                    onClick={() => setSlotUpdates(prev => ({ ...prev, [block.id]: { ...prev[block.id], status: prev[block.id].status === 'COMPLETED' ? 'UNRESOLVED' : 'COMPLETED' } }))}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      update.status === 'COMPLETED'
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : 'text-muted-foreground hover:bg-divider/50'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Done</span>
                                  </button>
                                  <button
                                    onClick={() => setSlotUpdates(prev => ({ ...prev, [block.id]: { ...prev[block.id], status: prev[block.id].status === 'SKIPPED' ? 'UNRESOLVED' : 'SKIPPED' } }))}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      update.status === 'SKIPPED'
                                        ? 'bg-red-500/10 text-red-500'
                                        : 'text-muted-foreground hover:bg-divider/50'
                                    }`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Skipped</span>
                                  </button>
                                  <button
                                    onClick={() => setShowRemark(prev => ({ ...prev, [block.id]: !prev[block.id] }))}
                                    className={`p-1.5 rounded-lg transition-colors ml-1 ${
                                      showRemark[block.id] || update.remark
                                        ? 'text-accent bg-accent/10'
                                        : 'text-muted-foreground hover:bg-divider/50'
                                    }`}
                                    title="Add remark"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {(showRemark[block.id] || update.remark) && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-3 pb-3 pt-1 border-t border-divider/20"
                                  >
                                    <input
                                      type="text"
                                      placeholder="Add a remark about this slot..."
                                      value={update.remark}
                                      onChange={(e) => setSlotUpdates(prev => ({
                                        ...prev,
                                        [block.id]: { ...prev[block.id], remark: e.target.value }
                                      }))}
                                      className="w-full text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60"
                                      autoFocus={showRemark[block.id] && !update.remark}
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-divider flex items-center justify-between flex-shrink-0 bg-sidebar/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleMarkAllSkipped}
                  className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-divider/50"
                >
                  Mark All Skipped
                </button>
                {unresolvedCount > 0 && (
                  <span className="text-xs text-muted-foreground/70">
                    {unresolvedCount} left unmarked
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save & Continue'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
