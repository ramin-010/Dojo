'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import type { ScheduleSlotProp } from '../DashboardClient';
import { updateDaySchedule } from '@/app/actions/schedule-slot.actions';
import { toast } from 'sonner';

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
  let mnorm = m;
  while (mnorm < 0) mnorm += 24 * 60;
  while (mnorm >= 24 * 60) mnorm -= 24 * 60;
  const h = Math.floor(mnorm / 60);
  const mins = mnorm % 60;
  return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────────

interface ComputedSlot extends ScheduleSlotProp {
  startMin: number;
  endMin: number;
  duration: number;
  isCurrentlyActive: boolean;
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
  
  // Real-time current minutes
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute base slots from props
  const baseSlots: ComputedSlot[] = todaySlots.map(slot => {
    const startMin = toMinutes(slot.startTime);
    let endMin = toMinutes(slot.endTime);
    if (endMin <= startMin) endMin += 24 * 60; // midnight crossover

    const isCurrentlyActive = currentMinutes >= startMin && currentMinutes < endMin;

    return {
      ...slot,
      startMin,
      endMin,
      duration: endMin - startMin,
      isCurrentlyActive,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  // Dragging State
  const containerRef = useRef<HTMLDivElement>(null);
  const [optimisticSlots, setOptimisticSlots] = useState<ComputedSlot[]>(baseSlots);
  
  // Sync when props change, UNLESS dragging
  const [dragState, setDragState] = useState<{
    id: string;
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    initialStartMin: number;
    initialEndMin: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState) {
      setOptimisticSlots(baseSlots);
    }
  }, [todaySlots, currentMinutes, dragState]); // Intentionally omitting baseSlots to avoid deep compare loops, todaySlots is fine

  // ── Compute Render Bounds based on Optimistic State ───────────────────────
  if (optimisticSlots.length === 0) {
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

  const allStarts = optimisticSlots.map(b => b.startMin);
  const allEnds = optimisticSlots.map(b => b.endMin);

  let timelineStart = Math.min(...allStarts);
  let timelineEnd = Math.max(...allEnds);

  // Give a little buffer on edges for easier dragging
  timelineStart -= 30; // 30 min buffer
  timelineEnd += 30;

  if (currentMinutes >= timelineStart && currentMinutes < timelineEnd) {
    timelineEnd = Math.max(timelineEnd, currentMinutes + 30);
  }

  const totalMinutes = timelineEnd - timelineStart;
  const toPct = (min: number) => ((min - timelineStart) / totalMinutes) * 100;

  // ── Drag Handlers ─────────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize-left' | 'resize-right') => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    e.preventDefault();

    const slot = optimisticSlots.find(s => s.id === id);
    if (!slot) return;

    setDragState({
      id,
      mode,
      startX: e.clientX,
      initialStartMin: slot.startMin,
      initialEndMin: slot.endMin,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.getBoundingClientRect().width;
      const deltaX = e.clientX - dragState.startX;
      const deltaRatio = deltaX / width;
      const deltaMinutesRaw = deltaRatio * totalMinutes;
      
      // Snap to 5-minute intervals for that "butter" crisp feel
      const deltaMinutes = Math.round(deltaMinutesRaw / 5) * 5;

      // Start with a fresh copy of baseSlots for deterministic cascading
      const newSlots = [...baseSlots];
      const draggedIdx = newSlots.findIndex(s => s.id === dragState.id);
      if (draggedIdx === -1) return;
      
      const draggedSlot = { ...newSlots[draggedIdx] };

      let newStart = dragState.initialStartMin;
      let newEnd = dragState.initialEndMin;

      if (dragState.mode === 'move') {
        newStart += deltaMinutes;
        newEnd += deltaMinutes;
      } else if (dragState.mode === 'resize-left') {
        newStart += deltaMinutes;
      } else if (dragState.mode === 'resize-right') {
        newEnd += deltaMinutes;
      }

      // Constraints
      if (newEnd <= newStart) {
        if (dragState.mode === 'resize-left') newStart = newEnd - 5;
        else if (dragState.mode === 'resize-right') newEnd = newStart + 5;
      }

      // Prevent dragging outside 24h absolute bounds (keep sanity)
      const dayStart = 0;
      const dayEnd = 24 * 60 * 2; // Allow up to 48h for next-day overflow

      newStart = Math.max(dayStart, Math.min(newStart, dayEnd - 5));
      newEnd = Math.max(newStart + 5, Math.min(newEnd, dayEnd));

      draggedSlot.startMin = newStart;
      draggedSlot.endMin = newEnd;
      draggedSlot.duration = newEnd - newStart;
      draggedSlot.startTime = minToStr(newStart);
      draggedSlot.endTime = minToStr(newEnd);

      newSlots[draggedIdx] = draggedSlot;

      // --- CASCADING LOGIC ---
      // Cascade RIGHT (pushing blocks after this one)
      for (let i = draggedIdx + 1; i < newSlots.length; i++) {
        const prevSlot = newSlots[i - 1];
        const currSlot = { ...newSlots[i] };
        
        // If previous block pushed into current block's start time
        if (prevSlot.endMin > currSlot.startMin) {
          const overlap = prevSlot.endMin - currSlot.startMin;
          currSlot.startMin += overlap;
          currSlot.endMin += overlap;
          currSlot.startTime = minToStr(currSlot.startMin);
          currSlot.endTime = minToStr(currSlot.endMin);
          newSlots[i] = currSlot;
        }
      }

      // Cascade LEFT (pushing blocks before this one)
      for (let i = draggedIdx - 1; i >= 0; i--) {
        const nextSlot = newSlots[i + 1];
        const currSlot = { ...newSlots[i] };

        // If next block pushed backwards into current block's end time
        if (nextSlot.startMin < currSlot.endMin) {
          const overlap = currSlot.endMin - nextSlot.startMin;
          currSlot.startMin -= overlap;
          currSlot.endMin -= overlap;
          
          currSlot.startTime = minToStr(currSlot.startMin);
          currSlot.endTime = minToStr(currSlot.endMin);
          newSlots[i] = currSlot;
        }
      }

      setOptimisticSlots(newSlots);
    };

    const handlePointerUp = async () => {
      // Save changes to DB
      const currentOptSlots = [...optimisticSlots]; // Capture current state
      setDragState(null); // Stop dragging

      // Did it actually move?
      const draggedSlot = currentOptSlots.find(s => s.id === dragState.id);
      if (!draggedSlot || 
          (draggedSlot.startMin === dragState.initialStartMin && 
           draggedSlot.endMin === dragState.initialEndMin)) {
        return; // Nothing changed, don't hit API
      }

      try {
        const updates = currentOptSlots.map(s => ({
          id: s.id,
          startTime: minToStr(s.startMin),
          endTime: minToStr(s.endMin),
          title: s.title,
          color: s.color,
          sortOrder: s.sortOrder
        }));
        await updateDaySchedule(updates);
      } catch (e) {
        console.error(e);
        toast.error('Failed to save timeline changes');
        setOptimisticSlots(baseSlots); // Revert on failure
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, totalMinutes, optimisticSlots, baseSlots]);


  // ── Render ────────────────────────────────────────────────────────────────
  
  const lastBlock = optimisticSlots[optimisticSlots.length - 1];
  const showEndLabel = lastBlock && lastBlock.duration > 60;
  const anyBlockCurrentlyActive = optimisticSlots.some(s => s.isCurrentlyActive);

  return (
    <section className="mb-12 mt-4 relative">
      <button 
        onClick={onManageDay} 
        className="absolute -top-6 right-0 p-1 text-muted hover:text-muted transition-colors outline-none z-20"
        title="Manage Day"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      <div className="relative mt-2" ref={containerRef}>
        
        {/* ── Background Bar (Track) ── */}
        <div className="absolute top-0 w-full h-[8px] rounded-full bg-divider/50 pointer-events-none" />

        {/* ── The Draggable Blocks ── */}
        <div className="relative h-[8px] rounded-full w-full">
          {optimisticSlots.map((block, i) => {
            const isSkipped = block.status === 'SKIPPED';
            const opacityClass = isSkipped ? 'opacity-40' : (block.isCurrentlyActive ? 'opacity-100' : 'opacity-80');
            const isDraggingThis = dragState?.id === block.id;
            
            const startPct = toPct(block.startMin);
            const widthPct = toPct(block.endMin) - startPct;

            return (
              <div
                key={block.id}
                className={`absolute top-0 h-full ${!dragState ? 'transition-all duration-300' : ''} ${opacityClass} group hover:opacity-100 z-10 ${isDraggingThis ? '!opacity-100 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-30' : ''}`}
                style={{
                  left: `${Math.max(0, startPct)}%`,
                  width: `${Math.max(0, widthPct)}%`,
                }}
              >
                {/* Visual Fill */}
                <div 
                  className={`w-full h-full rounded-full cursor-grab active:cursor-grabbing transition-colors ${isSkipped ? 'border border-dashed border-accent/50 !bg-transparent' : 'bg-accent'}`}
                  onPointerDown={(e) => handlePointerDown(e, block.id, 'move')}
                />

                {/* Left Resize Handle */}
                <div 
                  className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-6 cursor-ew-resize opacity-0 group-hover:opacity-100 flex items-center justify-center z-20"
                  onPointerDown={(e) => handlePointerDown(e, block.id, 'resize-left')}
                >
                  <div className="w-1 h-3 rounded-full bg-white shadow-sm" />
                </div>

                {/* Right Resize Handle */}
                <div 
                  className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-6 cursor-ew-resize opacity-0 group-hover:opacity-100 flex items-center justify-center z-20"
                  onPointerDown={(e) => handlePointerDown(e, block.id, 'resize-right')}
                >
                  <div className="w-1 h-3 rounded-full bg-white shadow-sm" />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Current Time Indicator ───────────────────────────────────────── */}
        {(() => {
          const pct = Math.max(0, Math.min(100, toPct(currentMinutes)));
          return (
            <div className="absolute top-[-3px] z-20 transition-all duration-1000 pointer-events-none" style={{ left: `${pct}%` }}>
              <div className={`w-[14px] h-[14px] rounded-full border-2 border-background -ml-[7px] ${
                anyBlockCurrentlyActive 
                  ? 'bg-accent shadow-[0_0_10px_rgba(0,122,204,0.6)]' 
                  : 'bg-foreground/40'
              }`} />
            </div>
          );
        })()}

        {/* ── Labels Below ─────────────────────────────────────────────────── */}
        <div className="relative mt-3 min-h-[35px] pointer-events-none">
          {optimisticSlots.map((block) => {
            const startPct = toPct(block.startMin);
            const widthPct = toPct(block.endMin) - startPct;
            const isDraggingThis = dragState?.id === block.id;

            return (
              <div 
                key={block.id}
                style={{ 
                  left: `${Math.max(0, startPct)}%`,
                  width: `${Math.max(0, widthPct)}%` 
                }} 
                className={`absolute top-0 min-w-0 pr-2 ${!dragState ? 'transition-all duration-300' : ''}`}
              >
                <div className="flex items-center gap-1.5" title={`${block.title}`}>
                    {block.isCurrentlyActive && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent animate-pulse" />
                    )}
                    <p className={`text-[10px] font-medium truncate ${
                      block.status === 'SKIPPED' ? 'line-through text-muted' :
                      (block.isCurrentlyActive || isDraggingThis) ? 'text-foreground/90' :
                      'text-muted'
                    }`}>
                      {block.title}
                    </p>
                  </div>
                  <p className={`text-[9.5px] font-mono mt-0.5 truncate ${
                    block.status === 'SKIPPED' ? 'text-muted' :
                    (block.isCurrentlyActive || isDraggingThis) ? 'text-accent' :
                    'text-muted'
                  }`}>
                    {format12h(minToStr(block.startMin))} {isDraggingThis ? `- ${format12h(minToStr(block.endMin))}` : ''}
                  </p>
                </div>
            );
          })}

          {/* End Time Label */}
          {showEndLabel && (
            <div className="absolute right-0 top-0 text-right w-[60px]">
              <p className="text-[10px] font-medium text-transparent select-none">End</p>
              <p className="text-[9px] font-mono mt-px text-muted">
                {format12h(lastBlock.endTime)}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}