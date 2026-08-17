'use client';

import { useState, useEffect } from 'react';
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

  // Sync when props change, UNLESS dragging
  // We don't have drag state anymore, just use baseSlots directly
  const renderSlots = baseSlots;

  // ── Compute Render Bounds ───────────────────────
  if (renderSlots.length === 0) {
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

  const allStarts = renderSlots.map(b => b.startMin);
  const allEnds = renderSlots.map(b => b.endMin);

  let timelineStart = Math.min(...allStarts);
  let timelineEnd = Math.max(...allEnds);

  // Give a little buffer on edges
  timelineStart -= 30; // 30 min buffer
  timelineEnd += 30;

  if (currentMinutes >= timelineStart && currentMinutes < timelineEnd) {
    timelineEnd = Math.max(timelineEnd, currentMinutes + 30);
  }

  const totalMinutes = timelineEnd - timelineStart;
  const toPct = (min: number) => ((min - timelineStart) / totalMinutes) * 100;
  
  const lastBlock = renderSlots[renderSlots.length - 1];
  const showEndLabel = lastBlock && lastBlock.duration > 60;
  const anyBlockCurrentlyActive = renderSlots.some(s => s.isCurrentlyActive);

  return (
    <section className="mb-12 mt-4 relative">
      <button 
        onClick={onManageDay} 
        className="absolute -top-6 right-0 p-1 text-muted hover:text-muted transition-colors outline-none z-20"
        title="Manage Day"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      <div className="relative mt-2">
        
        {/* ── Background Bar (Track) ── */}
        <div className="absolute top-0 w-full h-[8px] rounded-full bg-divider/50 pointer-events-none" />

        {/* ── The Static Blocks ── */}
        <div className="relative h-[8px] rounded-full w-full">
          {renderSlots.map((block, i) => {
            const isSkipped = block.status === 'SKIPPED';
            const opacityClass = isSkipped ? 'opacity-40' : (block.isCurrentlyActive ? 'opacity-100' : 'opacity-80');
            
            const startPct = toPct(block.startMin);
            const widthPct = toPct(block.endMin) - startPct;

            return (
              <div
                key={block.id}
                className={`absolute top-0 h-full transition-all duration-300 ${opacityClass} group hover:opacity-100 z-10`}
                style={{
                  left: `${Math.max(0, startPct)}%`,
                  width: `${Math.max(0, widthPct)}%`,
                }}
              >
                {/* Visual Fill */}
                <div 
                  className={`w-full h-full rounded-full transition-colors ${isSkipped ? 'border border-dashed border-accent/50 !bg-transparent' : 'bg-accent'}`}
                />
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
          {renderSlots.map((block) => {
            const startPct = toPct(block.startMin);
            const widthPct = toPct(block.endMin) - startPct;

            return (
              <div 
                key={block.id}
                style={{ 
                  left: `${Math.max(0, startPct)}%`,
                  width: `${Math.max(0, widthPct)}%` 
                }} 
                className={`absolute top-0 min-w-0 pr-2 transition-all duration-300`}
              >
                <div className="flex items-center gap-1.5" title={`${block.title}`}>
                    {block.isCurrentlyActive && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent animate-pulse" />
                    )}
                    <p className={`text-[10px] font-medium truncate ${
                      block.status === 'SKIPPED' ? 'line-through text-muted' :
                      (block.isCurrentlyActive) ? 'text-foreground/90' :
                      'text-muted'
                    }`}>
                      {block.title}
                    </p>
                  </div>
                  <p className={`text-[9.5px] font-mono mt-0.5 truncate ${
                    block.status === 'SKIPPED' ? 'text-muted' :
                    (block.isCurrentlyActive) ? 'text-accent' :
                    'text-muted'
                  }`}>
                    {format12h(minToStr(block.startMin))}
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