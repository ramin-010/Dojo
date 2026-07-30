'use client';

import { useState, useEffect } from 'react';
import { ActiveBlockActions } from '@/components/dashboard/ActiveBlockActions';
import { markSlotActive } from '@/app/actions/schedule-slot.actions';
import { useRouter } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import type { ScheduleSlotProp } from '../DashboardClient';

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────────

function format12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minToStr(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mins = m % 60;
  return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────────

interface ComputedSlot extends ScheduleSlotProp {
  originalStartMin: number;
  originalEndMin: number;
  originalDuration: number;
  renderStartMin: number;
  renderEndMin: number;
  shadowMarkMin?: number; // Where the "quota" marker goes
  isConsumed: boolean;    // Fully eaten by flow state
}

interface ScheduleTimelineProps {
  todaySlots: ScheduleSlotProp[];
  onManageDay?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

export default function ScheduleTimeline({ todaySlots, onManageDay }: ScheduleTimelineProps) {
  const router = useRouter();
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Tick the clock every 30 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-activation effect
  useEffect(() => {
    if (todaySlots.length === 0) return;

    const hasActive = todaySlots.some(s => s.status === 'ACTIVE');
    if (hasActive) return;

    // Find if we should activate an UPCOMING slot
    for (const slot of todaySlots) {
      if (slot.status === 'UPCOMING') {
        const startMin = toMinutes(slot.startTime);
        let endMin = toMinutes(slot.endTime);
        if (endMin <= startMin) endMin += 24 * 60;

        let adjustedCurrentMin = currentMinutes;
        const timelineStartBase = toMinutes(todaySlots[0].startTime);
        if (adjustedCurrentMin < timelineStartBase && endMin > 24 * 60) {
          adjustedCurrentMin += 24 * 60;
        }

        if (adjustedCurrentMin >= startMin && adjustedCurrentMin < endMin) {
          markSlotActive(slot.id).catch(console.error);
          break;
        }
      }
    }
  }, [currentMinutes, todaySlots]);

  if (todaySlots.length === 0) {
    return (
      <section className="mb-8 mt-2">
        <div className="relative">
          <div className="relative flex h-[6px] rounded-full overflow-hidden bg-divider">
            <div className="h-full w-full bg-divider" />
          </div>
        </div>
      </section>
    );
  }

  // ── Step 1: Build computed blocks with original times ──────────────────────
  const computedSlots: ComputedSlot[] = todaySlots.map(slot => {
    const startMin = toMinutes(slot.startTime);
    let endMin = toMinutes(slot.endTime);
    if (endMin <= startMin) endMin += 24 * 60; // midnight crossover

    return {
      ...slot,
      originalStartMin: startMin,
      originalEndMin: endMin,
      originalDuration: endMin - startMin,
      renderStartMin: startMin,
      renderEndMin: endMin,
      isConsumed: false,
    };
  });

  // Ensure they are sorted by sortOrder
  computedSlots.sort((a, b) => a.sortOrder - b.sortOrder);

  // ── Step 2: Apply cascade shrink if a block is ACTIVE ─────────────────────
  let adjustedCurrentMin = currentMinutes;
  const timelineStartBase = computedSlots[0].originalStartMin;
  if (adjustedCurrentMin < timelineStartBase && computedSlots[computedSlots.length - 1].originalEndMin > 24 * 60) {
    adjustedCurrentMin += 24 * 60;
  }

  const activeIdx = computedSlots.findIndex(s => s.status === 'ACTIVE');

  if (activeIdx >= 0) {
    const activeSlot = computedSlots[activeIdx];
    // The active block stretches to the current time (if past its end)
    const extendedEnd = Math.max(activeSlot.originalEndMin, adjustedCurrentMin);
    computedSlots[activeIdx].renderEndMin = extendedEnd;

    // Cascade: shrink or consume all subsequent UPCOMING blocks
    let cascadeEdge = extendedEnd;
    for (let i = activeIdx + 1; i < computedSlots.length; i++) {
      const b = computedSlots[i];
      if (b.status !== 'UPCOMING') continue; // Only UPCOMING blocks can be eaten

      if (cascadeEdge >= b.originalEndMin) {
        // Fully consumed visually
        b.isConsumed = true;
        b.renderStartMin = b.originalEndMin; // zero width
        b.renderEndMin = b.originalEndMin;
      } else if (cascadeEdge > b.originalStartMin) {
        // Partially shrunk — add shadow mark if > 15 min eaten
        const eatenMin = cascadeEdge - b.originalStartMin;
        b.renderStartMin = cascadeEdge;
        b.renderEndMin = b.originalEndMin;
        
        // Shadow mark
        if (eatenMin > 15) {
          const mark = b.originalStartMin + b.originalDuration;
          if (adjustedCurrentMin < mark) {
            b.shadowMarkMin = mark;
          }
        }
      } else {
        // Not affected
        break;
      }
      cascadeEdge = b.originalEndMin;
    }
  }

  // ── Step 3: Apply partial block shrinking ─────────────────────────────────
  computedSlots.forEach(b => {
    if (b.status === 'PARTIAL' && b.minutesDone !== null && b.minutesDone !== undefined && b.minutesDone > 0) {
      b.renderEndMin = b.renderStartMin + b.minutesDone;
    } else if ((b.status === 'COMPLETED' || b.status === 'SKIPPED') && b.actualEndTime) {
      const actualEndMin = toMinutes(b.actualEndTime);
      if (actualEndMin < b.originalEndMin && actualEndMin >= b.originalStartMin) {
        b.renderEndMin = actualEndMin;
      }
    }
  });

  // ── Step 4: Compute render bounds ─────────────────────────────────────────
  const allRenderStarts = computedSlots.map(b => b.renderStartMin);
  const allRenderEnds = computedSlots.map(b => b.renderEndMin);
  // Also include shadow marks in the timeline range
  const shadowEnds = computedSlots.filter(b => b.shadowMarkMin).map(b => b.shadowMarkMin!);

  const timelineStart = Math.min(...allRenderStarts);
  let timelineEnd = Math.max(...allRenderEnds, ...shadowEnds);

  // Ensure timeline includes current time if active
  if (activeIdx >= 0) {
    timelineEnd = Math.max(timelineEnd, adjustedCurrentMin + 10);
  }

  const totalMinutes = timelineEnd - timelineStart;
  if (totalMinutes <= 0) return null;

  const toPct = (min: number) => ((min - timelineStart) / totalMinutes) * 100;

  // ── Render ────────────────────────────────────────────────────────────────

  // Last block info for end label
  const lastBlock = computedSlots[computedSlots.length - 1];
  const lastBlockDuration = lastBlock.renderEndMin - lastBlock.renderStartMin;
  const showEndLabel = lastBlockDuration > 90;

  return (
    <section className="mb-8 mt-4 relative">
      <button 
        onClick={onManageDay} 
        className="absolute -top-5 right-0 p-1 text-foreground/20 hover:text-foreground/70 transition-colors outline-none z-10"
        title="Manage Day"
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      <div className="relative mt-2">
        {/* ── The Bar ──────────────────────────────────────────────────────── */}
        <div className="relative h-[6px] rounded-full overflow-hidden bg-divider">
          {computedSlots.map((block, i) => {
            if (block.isConsumed) return null; // Invisible

            const isLastBlock = i === computedSlots.length - 1;
            const isSkipped = block.status === 'SKIPPED';
            const opacityClass = isSkipped ? 'opacity-40' : (block.status === 'UPCOMING' ? 'opacity-40' : (block.status === 'ACTIVE' ? 'opacity-100' : 'opacity-60'));
            
            const startPct = toPct(block.renderStartMin);
            const widthPct = toPct(block.renderEndMin) - startPct;

            return (
              <div
                key={block.id}
                className={`absolute top-0 h-full transition-all duration-500 ${opacityClass} ${!isLastBlock ? 'border-r-2 border-background' : ''} ${isSkipped ? 'border border-dashed !bg-transparent' : ''}`}
                style={{
                  left: `${Math.max(0, startPct)}%`,
                  width: `${Math.max(0, widthPct)}%`,
                  backgroundColor: isSkipped ? 'transparent' : block.color,
                  borderColor: isSkipped ? block.color : undefined,
                }}
              />
            );
          })}
        </div>

        {/* ── Shadow Marks (quota indicators) ──────────────────────────────── */}
        {computedSlots.filter(b => b.shadowMarkMin && !b.isConsumed).map(block => {
          const pct = toPct(block.shadowMarkMin!);
          if (pct < 0 || pct > 100) return null;
          return (
            <div
              key={`shadow-${block.id}`}
              className="absolute top-[-2px] h-[10px] w-[2px] rounded-full opacity-30"
              style={{ left: `${pct}%`, backgroundColor: block.color }}
              title={`${block.title} original quota ends here`}
            />
          );
        })}

        {/* ── Current Time Indicator ───────────────────────────────────────── */}
        {(() => {
          const pct = Math.max(0, Math.min(100, toPct(adjustedCurrentMin)));
          const isCurrentlyActive = activeIdx >= 0;
          return (
            <div className="absolute top-[-4px] z-10" style={{ left: `${pct}%` }}>
              <div className={`w-[14px] h-[14px] rounded-full border-2 border-background -ml-[7px] ${
                isCurrentlyActive 
                  ? 'bg-accent shadow-[0_0_10px_rgba(0,122,204,0.6)]' 
                  : 'bg-foreground/40'
              }`} />
            </div>
          );
        })()}

        {/* ── Labels Below ─────────────────────────────────────────────────── */}
        <div className="relative mt-2.5 min-h-[30px]">
          {computedSlots.map((block, i) => {
            if (block.isConsumed) return null;

            const isActivelyRunning = block.status === 'ACTIVE';
            const isLastBlock = i === computedSlots.length - 1;

            // Find if this is the next upcoming block
            const activeIndex = computedSlots.findIndex(s => s.status === 'ACTIVE');
            const searchStartIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
            const firstUpcomingIdx = computedSlots.findIndex((b, idx) => 
              idx >= searchStartIndex && 
              b.status === 'UPCOMING' && 
              !b.isConsumed &&
              b.originalEndMin > adjustedCurrentMin
            );
            const isNextUpcoming = i === firstUpcomingIdx;
            
            const isPassed = adjustedCurrentMin >= block.originalEndMin;
            const showHoverActions = isActivelyRunning || (!isPassed && (isNextUpcoming || block.status === 'UPCOMING'));

            const startPct = toPct(block.renderStartMin);
            const widthPct = toPct(block.renderEndMin) - startPct;

            return (
              <div 
                key={block.id}
                style={{ 
                  left: `${Math.max(0, startPct)}%`,
                  width: `${Math.max(0, widthPct)}%` 
                }} 
                className="absolute top-0 min-w-0 pr-2 group"
              >
                <div className="flex items-center gap-1.5" title={`${block.title} (${format12h(minToStr(block.renderStartMin))} - ${format12h(minToStr(block.renderEndMin))})`}>
                    {isActivelyRunning && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent animate-pulse" />
                    )}
                    <p className={`text-[10px] font-medium truncate cursor-default ${
                      block.status === 'SKIPPED' ? 'line-through text-foreground/20' :
                      block.status === 'ACTIVE' ? 'text-foreground/70' :
                      'text-foreground/30'
                    }`}>
                      {block.title}
                    </p>
                  </div>
                  <p className={`text-[9px] font-mono mt-px truncate ${
                    block.status === 'SKIPPED' ? 'text-foreground/15' :
                    block.status === 'ACTIVE' ? 'text-foreground/50' :
                    'text-foreground/20'
                  }`}>
                    {format12h(minToStr(block.renderStartMin))}
                  </p>

                  {/* Hover actions */}
                  {showHoverActions && (
                    <ActiveBlockActions
                      currentSlot={block}
                      isLast={isLastBlock}
                      isNextUpcoming={isNextUpcoming}
                      onManageDay={onManageDay}
                    />
                  )}
                </div>
            );
          })}

          {/* End Time Label */}
          {showEndLabel && (
            <div className="absolute right-0 top-0 text-right w-[60px]">
              <p className="text-[10px] font-medium text-transparent select-none">End</p>
              <p className="text-[9px] font-mono mt-px text-foreground/40">
                {format12h(lastBlock.endTime)}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}