'use client';

import { useState, useEffect } from 'react';
import { 
  Play, Square, FastForward, Pause, SkipForward, 
  Clock, ArrowRight, RefreshCw, Check 
} from 'lucide-react';

interface ScheduleBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  log?: {
    id: string;
    outcome: string;
    remark?: string | null;
  } | null;
}

interface CurrentBlockWidgetProps {
  blocks: ScheduleBlock[];
  onComplete: (blockId: string) => void;
  onEndEarly: (blockId: string) => void;
  onInterrupt: (blockId: string, remark: string, category: string) => void;
  onExtend: (currentBlockId: string, nextBlockId: string) => void;
  onPreSkip: (blockId: string, remark: string, category: string) => void;
  onReplace: (victimBlockId: string) => void;
}

const REMARK_CATEGORIES = [
  { value: 'WORK_EMERGENCY', label: 'Work Emergency' },
  { value: 'MEETING', label: 'Unexpected Meeting' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'OTHER', label: 'Other' },
];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function format12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDuration(mins: number): string {
  if (mins < 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export default function CurrentBlockWidget({
  blocks,
  onComplete,
  onEndEarly,
  onInterrupt,
  onExtend,
  onPreSkip,
  onReplace,
}: CurrentBlockWidgetProps) {
  const [now, setNow] = useState(new Date());
  const [showRemarkInput, setShowRemarkInput] = useState<'interrupt' | 'preskip' | null>(null);
  const [remark, setRemark] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [targetBlockId, setTargetBlockId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update clock every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Find active block (currently in progress and not already logged)
  const activeBlock = blocks.find(b => {
    const start = timeToMinutes(b.startTime);
    const end = timeToMinutes(b.endTime);
    return currentMinutes >= start && currentMinutes < end && !b.log;
  });

  // Find next upcoming block (not yet started and not logged)
  const upcomingBlocks = blocks.filter(b => {
    const start = timeToMinutes(b.startTime);
    return start > currentMinutes && !b.log;
  });
  const nextBlock = upcomingBlocks[0] || null;

  // Find next block after active (for Extend button)
  const nextAfterActive = activeBlock ? blocks.find(b => {
    const start = timeToMinutes(b.startTime);
    const activeEnd = timeToMinutes(activeBlock.endTime);
    return start >= activeEnd && !b.log;
  }) : null;

  // All blocks done for today
  const allDone = !activeBlock && !nextBlock;

  const handleRemarkSubmit = async () => {
    if (!targetBlockId || !remark.trim()) return;
    setIsSubmitting(true);
    try {
      if (showRemarkInput === 'interrupt') {
        await onInterrupt(targetBlockId, remark, category);
      } else if (showRemarkInput === 'preskip') {
        await onPreSkip(targetBlockId, remark, category);
      }
    } finally {
      setIsSubmitting(false);
      setShowRemarkInput(null);
      setRemark('');
      setCategory('OTHER');
      setTargetBlockId(null);
    }
  };

  // ── Remark Input Overlay ──
  if (showRemarkInput) {
    return (
      <div className="bg-sidebar border border-divider rounded-xl p-4 mb-6">
        <p className="text-[13px] font-semibold text-foreground mb-3">
          {showRemarkInput === 'interrupt' ? 'Why are you stopping?' : 'Why are you skipping?'}
        </p>
        <div className="flex flex-col gap-3">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-background border border-divider rounded-md px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-accent"
          >
            {REMARK_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={remark}
            onChange={e => setRemark(e.target.value)}
            placeholder="Brief remark (e.g., 'Prod bug P0')"
            className="bg-background border border-divider rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleRemarkSubmit()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleRemarkSubmit}
              disabled={!remark.trim() || isSubmitting}
              className="flex-1 px-3 py-2 bg-accent text-white rounded-md text-[13px] font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </button>
            <button
              onClick={() => { setShowRemarkInput(null); setRemark(''); setTargetBlockId(null); }}
              className="px-3 py-2 bg-sidebar border border-divider rounded-md text-[13px] text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── All Done ──
  if (allDone) {
    const pastBlocks = blocks.filter(b => timeToMinutes(b.endTime) <= currentMinutes);
    if (pastBlocks.length === 0) return null; // No blocks at all today
    
    return (
      <div className="bg-sidebar border border-divider rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">All done for today</p>
          <p className="text-[11px] text-foreground/40">Your schedule is clear. Great job!</p>
        </div>
      </div>
    );
  }

  // ── Active Block ──
  if (activeBlock) {
    const endMinutes = timeToMinutes(activeBlock.endTime);
    const remaining = endMinutes - currentMinutes;

    return (
      <div className="bg-sidebar border border-divider rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeBlock.color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Live</span>
            </div>
            <span className="text-[15px] font-semibold text-foreground">{activeBlock.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-foreground/50">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{formatDuration(remaining)} left</span>
          </div>
        </div>
        
        <p className="text-[11px] text-foreground/30 mb-4">
          {format12h(activeBlock.startTime)} — {format12h(activeBlock.endTime)}
        </p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-background rounded-full mb-4 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000"
            style={{ 
              width: `${Math.min(100, ((currentMinutes - timeToMinutes(activeBlock.startTime)) / (endMinutes - timeToMinutes(activeBlock.startTime))) * 100)}%`,
              backgroundColor: activeBlock.color 
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onComplete(activeBlock.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md text-[12px] font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <Check className="w-3 h-3" /> Complete
          </button>
          <button
            onClick={() => onEndEarly(activeBlock.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar border border-divider rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
          >
            <FastForward className="w-3 h-3" /> End Early
          </button>
          <button
            onClick={() => { setShowRemarkInput('interrupt'); setTargetBlockId(activeBlock.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar border border-divider rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
          >
            <Pause className="w-3 h-3" /> Interrupt
          </button>
          {nextAfterActive && (
            <button
              onClick={() => onExtend(activeBlock.id, nextAfterActive.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar border border-divider rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
              title={`Extend into "${nextAfterActive.title}"`}
            >
              <SkipForward className="w-3 h-3" /> Extend
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Next Up (between blocks) ──
  if (nextBlock) {
    const startMinutes = timeToMinutes(nextBlock.startTime);
    const untilStart = startMinutes - currentMinutes;

    return (
      <div className="bg-sidebar border border-divider rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full opacity-40" style={{ backgroundColor: nextBlock.color }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/30">Next Up</span>
            <span className="text-[15px] font-semibold text-foreground">{nextBlock.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-foreground/40">
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="font-medium">in {formatDuration(untilStart)}</span>
          </div>
        </div>
        
        <p className="text-[11px] text-foreground/30 mb-4">
          {format12h(nextBlock.startTime)} — {format12h(nextBlock.endTime)}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowRemarkInput('preskip'); setTargetBlockId(nextBlock.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar border border-divider rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
          >
            <SkipForward className="w-3 h-3" /> Pre-Skip
          </button>
          <button
            onClick={() => onReplace(nextBlock.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar border border-divider rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Replace
          </button>
        </div>
      </div>
    );
  }

  return null;
}
