'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  X, GripVertical, Plus, Minus, Clock, Coffee,
  Lock, Unlock, CheckCircle2, SkipForward,
  CircleDot, Timer, FastForward,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DayManagerSlotUpdate, updateDaySchedule } from '@/app/actions/schedule-slot.actions';
import { SlotStatus } from '@prisma/client';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS & TYPES
// ═══════════════════════════════════════════════════════════════════════

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#14b8a6', '#6366f1', '#6b7280',
];

type LocalSlot = {
  id: string;
  title: string;
  color: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  status: SlotStatus;
  sortOrder: number;
  durationMin: number;
  isPinned: boolean;
};

interface DayManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlots: {
    id: string;
    title: string;
    color: string;
    startTime: string;
    endTime: string;
    status: SlotStatus;
    sortOrder: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

const parseTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (min: number) => {
  let m = Math.floor(min);
  if (m < 0) m += 24 * 60;
  if (m >= 24 * 60) m -= 24 * 60;
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
};

const format12h = (time24: string): string => {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
};

const isPastStatus = (status: SlotStatus) =>
  status === 'COMPLETED' || status === 'SKIPPED' || status === 'PARTIAL';

const formatCurrentTime = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

// ── Read-only past block ────────────────────────────────────────────────

function PastBlockItem({ slot }: { slot: LocalSlot }) {
  const icon =
    slot.status === 'COMPLETED' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/50" /> :
    slot.status === 'SKIPPED'   ? <SkipForward  className="w-3.5 h-3.5 text-foreground/25" /> :
                                  <CircleDot    className="w-3.5 h-3.5 text-amber-500/50" />;

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl opacity-40 select-none">
      <div className="w-6" />
      <div
        className="w-2 h-8 rounded-full shrink-0 opacity-50"
        style={{ backgroundColor: slot.color }}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${slot.status === 'SKIPPED' ? 'line-through text-foreground/30' : 'text-foreground/50'}`}>
          {slot.title}
        </p>
        <p className="text-[11px] font-mono text-foreground/25">
          {format12h(slot.startTime)} – {format12h(slot.endTime)}
        </p>
      </div>
      {icon}
    </div>
  );
}

// ── Current-time horizon divider ────────────────────────────────────────

function NowDivider() {
  const [timeStr, setTimeStr] = useState(formatCurrentTime);

  useEffect(() => {
    const i = setInterval(() => setTimeStr(formatCurrentTime()), 30_000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex items-center gap-3 py-3 px-2 my-1">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/5 border border-accent/15">
        <Timer className="w-3 h-3 text-accent/70" />
        <span className="text-[11px] font-semibold text-accent/70 tracking-wide">{timeStr}</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </div>
  );
}

// ── Clickable free-buffer gap row ───────────────────────────────────────

function GapRow({
  startMin, endMin, onFill,
}: {
  startMin: number; endMin: number; onFill: () => void;
}) {
  const dur = endMin - startMin;
  if (dur < 5) return null;

  const h = Math.floor(dur / 60);
  const m = dur % 60;
  const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;

  return (
    <button
      onClick={onFill}
      className="group w-full flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-divider/25 hover:border-accent/30 hover:bg-accent/5 transition-all my-1 outline-none"
    >
      <div className="w-6 flex items-center justify-center">
        <Plus className="w-3.5 h-3.5 text-foreground/15 group-hover:text-accent transition-colors" />
      </div>
      <span className="text-xs font-medium text-foreground/20 group-hover:text-foreground/50 transition-colors">
        {label} free
      </span>
      <span className="text-[10px] font-mono text-foreground/15 group-hover:text-foreground/30 transition-colors">
        {format12h(formatTime(startMin))} – {format12h(formatTime(endMin))}
      </span>
      <span className="ml-auto text-[10px] font-semibold text-transparent group-hover:text-accent transition-colors">
        + Fill
      </span>
    </button>
  );
}

// ── Draggable / editable future block ───────────────────────────────────

function SortableItem({
  slot, onUpdate, onDelete, isActive, hasOverlap,
}: {
  slot: LocalSlot;
  onUpdate: (id: string, u: Partial<LocalSlot>) => void;
  onDelete: (id: string) => void;
  isActive: boolean;
  hasOverlap: boolean;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: slot.id, disabled: isActive });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const isBreak = slot.title.toLowerCase().includes('break');

  const cycleColor = () => {
    const idx = PRESET_COLORS.indexOf(slot.color);
    const next = PRESET_COLORS[(idx + 1) % PRESET_COLORS.length];
    onUpdate(slot.id, { color: next });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-center gap-3 p-2 rounded-xl border mb-1 transition-all',
        isDragging  ? 'shadow-xl opacity-90 border-accent/30 bg-hover' : 'border-transparent hover:bg-hover/60',
        isActive    ? 'border-accent/20 bg-accent/5'  : '',
        hasOverlap  ? '!border-amber-500/30 bg-amber-500/5' : '',
      ].join(' ')}
    >
      {/* ── Drag handle / active indicator ── */}
      {!isActive ? (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 text-foreground/20 hover:text-foreground/60 outline-none transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      ) : (
        <div className="w-6 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        </div>
      )}

      {/* ── Color bar ── */}
      <button
        onClick={cycleColor}
        className="w-2 h-10 rounded-full shrink-0 transition-transform active:scale-90 cursor-pointer"
        style={{ backgroundColor: slot.color }}
        title="Click to change color"
      />

      {/* ── Title + time ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 py-0.5">
        <input
          value={slot.title}
          onChange={(e) => onUpdate(slot.id, { title: e.target.value })}
          placeholder="Block Title"
          className={`bg-transparent outline-none w-full text-sm font-semibold transition-colors placeholder:text-foreground/20 focus:text-accent ${isBreak ? 'text-foreground/50' : 'text-foreground/90'}`}
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="time"
            value={slot.startTime}
            onChange={(e) => {
              if (e.target.value) {
                onUpdate(slot.id, { startTime: e.target.value, isPinned: true });
              }
            }}
            className={`bg-transparent text-[11px] font-mono outline-none hover:bg-hover/60 focus:bg-hover rounded px-1 cursor-pointer transition-colors ${
              slot.isPinned ? 'text-amber-400 font-semibold' : 'text-foreground/50 hover:text-foreground'
            }`}
            title="Click to set start time (automatically pins block)"
          />
          <span className="text-[11px] font-mono text-foreground/25">–</span>
          <input
            type="time"
            value={slot.endTime}
            onChange={(e) => {
              if (e.target.value) {
                const startMin = parseTime(slot.startTime);
                let endMin = parseTime(e.target.value);
                if (endMin <= startMin) endMin += 24 * 60;
                const dur = Math.max(5, endMin - startMin);
                onUpdate(slot.id, { durationMin: dur });
              }
            }}
            className="bg-transparent text-[11px] font-mono text-foreground/50 hover:text-foreground outline-none hover:bg-hover/60 focus:bg-hover rounded px-1 cursor-pointer transition-colors"
            title="Click to set end time (automatically adjusts duration)"
          />
          {slot.isPinned && (
            <span className="text-[9px] font-medium text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded-full leading-none flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5 inline" /> Pinned
            </span>
          )}
          {hasOverlap && (
            <span className="text-[9px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full leading-none">
              OVERLAP
            </span>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-1.5 pr-1 opacity-50 group-hover:opacity-100 transition-opacity">
        {/* Pin toggle (not for ACTIVE blocks) */}
        {!isActive && (
          <button
            onClick={() => onUpdate(slot.id, { isPinned: !slot.isPinned })}
            className={`p-1.5 rounded-lg transition-colors outline-none ${
              slot.isPinned
                ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                : 'text-foreground/20 hover:text-foreground/50 hover:bg-hover'
            }`}
            title={slot.isPinned ? 'Unpin (allow cascading)' : 'Pin at this time'}
          >
            {slot.isPinned ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        )}

        {/* Duration ± controls */}
        <div className="flex items-center bg-background/50 rounded-lg px-1 py-0.5 focus-within:bg-background transition-colors">
          <button
            onClick={() => onUpdate(slot.id, { durationMin: Math.max(5, slot.durationMin - 15) })}
            className="p-1 hover:text-accent text-foreground/40 transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            value={slot.durationMin || ''}
            onChange={(e) =>
              onUpdate(slot.id, { durationMin: Math.max(5, parseInt(e.target.value) || 5) })
            }
            className="w-8 bg-transparent text-xs font-mono text-center outline-none text-foreground/70 hide-arrows"
          />
          <span className="text-[10px] font-mono text-foreground/30 pr-0.5">m</span>
          <button
            onClick={() => onUpdate(slot.id, { durationMin: slot.durationMin + 15 })}
            className="p-1 hover:text-accent text-foreground/40 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="w-px h-4 bg-divider/30" />

        {/* Skip */}
        <button
          onClick={() => onUpdate(slot.id, { status: 'SKIPPED' })}
          className="px-2 py-1 rounded-lg hover:bg-hover text-[11px] font-medium text-foreground/40 hover:text-foreground transition-colors outline-none"
          title="Skip block"
        >
          Skip
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(slot.id)}
          className="p-1 rounded-lg hover:bg-red-500/10 text-foreground/20 hover:text-red-400 transition-colors outline-none"
          title="Remove block"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function DayManagerModal({ isOpen, onClose, initialSlots }: DayManagerModalProps) {
  const [slots, setSlots] = useState<LocalSlot[]>([]);
  const [dayStartMin, setDayStartMin] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newDuration, setNewDuration] = useState(60);

  // ── Derived views ──────────────────────────────────────────────────────

  const pastSlots = useMemo(
    () => slots.filter(s => isPastStatus(s.status)).sort((a, b) => a.sortOrder - b.sortOrder),
    [slots],
  );

  const futureSlots = useMemo(
    () => slots.filter(s => !isPastStatus(s.status)),
    [slots],
  );

  const hasActiveBlock  = useMemo(() => futureSlots.some(s => s.status === 'ACTIVE'), [futureSlots]);
  const hasPastBlocks   = pastSlots.length > 0;
  const hasFutureBlocks = futureSlots.length > 0;

  const futureDuration  = futureSlots.reduce((a, s) => a + s.durationMin, 0);
  const futureHours     = Math.floor(futureDuration / 60);
  const futureMinutes   = futureDuration % 60;

  // ── Initialization ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const parsed: LocalSlot[] = initialSlots
      .map(s => {
        let dur = parseTime(s.endTime) - parseTime(s.startTime);
        if (dur <= 0) dur += 24 * 60;
        return { ...s, durationMin: dur, isPinned: false };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    setSlots(parsed);

    const future = parsed.filter(s => !isPastStatus(s.status));
    if (future.length > 0) {
      setDayStartMin(parseTime(future[0].startTime));
    } else {
      const past = parsed.filter(s => isPastStatus(s.status));
      setDayStartMin(
        past.length > 0
          ? parseTime(past[past.length - 1].endTime)
          : new Date().getHours() * 60,
      );
    }
  }, [isOpen, initialSlots]);

  // ── Recalculation engine ───────────────────────────────────────────────
  //
  //  Cascades future-block times while respecting:
  //   • ACTIVE blocks: start time is locked (from the live system)
  //   • Pinned blocks:  start time is fixed (user-set anchor)
  //   • Normal blocks:  cascade from previous block's end
  //
  const recalculate = (allSlots: LocalSlot[], startMin: number): LocalSlot[] => {
    const past   = allSlots.filter(s => isPastStatus(s.status));
    const future = allSlots.filter(s => !isPastStatus(s.status));
    if (future.length === 0) return allSlots;

    let currentMin = startMin;

    const recalculated = future.map((slot, idx) => {
      // ACTIVE — locked start, only endTime adjusts with duration
      if (slot.status === 'ACTIVE') {
        const start = parseTime(slot.startTime);
        const end   = start + slot.durationMin;
        currentMin  = end;
        return { ...slot, endTime: formatTime(end), sortOrder: past.length + idx };
      }

      // PINNED — keeps its own startTime as an anchor
      if (slot.isPinned) {
        const pStart = parseTime(slot.startTime);
        const pEnd   = pStart + slot.durationMin;
        currentMin   = pEnd;
        return { ...slot, endTime: formatTime(pEnd), sortOrder: past.length + idx };
      }

      // NORMAL — push-only cascade: preserve existing start time unless pushed by previous block's end time
      const existingStart = parseTime(slot.startTime);
      const newStart = idx === 0 ? currentMin : Math.max(currentMin, existingStart);
      const newEnd   = newStart + slot.durationMin;
      currentMin     = newEnd;
      return {
        ...slot,
        startTime: formatTime(newStart),
        endTime:   formatTime(newEnd),
        sortOrder: past.length + idx,
      };
    });

    return [...past, ...recalculated];
  };

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleUpdate = (id: string, updates: Partial<LocalSlot>) => {
    setSlots(items => {
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return items;

      const updated = [...items];
      updated[idx]  = { ...updated[idx], ...updates };

      const needsRecalc =
        updates.durationMin !== undefined ||
        updates.isPinned    !== undefined ||
        updates.startTime   !== undefined ||
        updates.status      !== undefined;

      return needsRecalc ? recalculate(updated, dayStartMin) : updated;
    });
  };

  const handleDelete = (id: string) => {
    setSlots(items => recalculate(items.filter(i => i.id !== id), dayStartMin));
  };

  const handleAddBlock = (isBreak = false) => {
    setSlots(items => {
      const future     = items.filter(s => !isPastStatus(s.status));
      const lastFuture = future[future.length - 1];
      const start      = lastFuture ? parseTime(lastFuture.endTime) : dayStartMin;
      const dur        = isBreak ? 15 : 60;

      const newSlot: LocalSlot = {
        id: `new-${Date.now()}`,
        title: isBreak ? 'Break' : 'New Block',
        color: isBreak ? '#6b7280' : '#8b5cf6',
        startTime: formatTime(start),
        endTime:   formatTime(start + dur),
        status: 'UPCOMING',
        sortOrder: items.length,
        durationMin: dur,
        isPinned: false,
      };
      return recalculate([...items, newSlot], dayStartMin);
    });
  };

  const handleCreateCustomBlock = (title: string, startTimeStr: string, durationMin: number) => {
    setSlots(items => {
      const future = items.filter(s => !isPastStatus(s.status));
      const lastFuture = future[future.length - 1];
      const defaultStartMin = lastFuture ? parseTime(lastFuture.endTime) : dayStartMin;
      const chosenStartMin = parseTime(startTimeStr || '09:00');
      const isCustomTime = chosenStartMin !== defaultStartMin;

      const newSlot: LocalSlot = {
        id: `new-${Date.now()}`,
        title: title || 'New Block',
        color: '#8b5cf6',
        startTime: formatTime(chosenStartMin),
        endTime: formatTime(chosenStartMin + durationMin),
        status: 'UPCOMING',
        sortOrder: items.length,
        durationMin: durationMin,
        isPinned: isCustomTime,
      };
      return recalculate([...items, newSlot], dayStartMin);
    });
  };

  /** Fill a gap between two blocks with a new block that exactly covers it */
  const handleFillGap = (insertIdx: number, startMin: number, endMin: number) => {
    setSlots(items => {
      const past   = items.filter(s => isPastStatus(s.status));
      const future = items.filter(s => !isPastStatus(s.status));
      const dur    = endMin - startMin;

      const newSlot: LocalSlot = {
        id: `new-${Date.now()}`,
        title: 'New Block',
        color: '#8b5cf6',
        startTime: formatTime(startMin),
        endTime:   formatTime(endMin),
        status: 'UPCOMING',
        sortOrder: 0,
        durationMin: dur,
        isPinned: false,
      };
      future.splice(insertIdx, 0, newSlot);
      return recalculate([...past, ...future], dayStartMin);
    });
  };

  /** Delay +30m (no active) or Insert 30m Break (has active) */
  const handlePushDelay = () => {
    if (hasActiveBlock) {
      // Insert a 30-minute break right after the ACTIVE block
      setSlots(items => {
        const past   = items.filter(s => isPastStatus(s.status));
        const future = items.filter(s => !isPastStatus(s.status));
        const activeIdx = future.findIndex(s => s.status === 'ACTIVE');

        if (activeIdx < 0) return items;

        const afterEnd = parseTime(future[activeIdx].endTime);
        const breakSlot: LocalSlot = {
          id: `new-break-${Date.now()}`,
          title: 'Break',
          color: '#6b7280',
          startTime: formatTime(afterEnd),
          endTime:   formatTime(afterEnd + 30),
          status: 'UPCOMING',
          sortOrder: 0,
          durationMin: 30,
          isPinned: false,
        };
        const newFuture = [...future];
        newFuture.splice(activeIdx + 1, 0, breakSlot);
        return recalculate([...past, ...newFuture], dayStartMin);
      });
    } else {
      // Shift the cascade start by +30 min
      const newStart = dayStartMin + 30;
      setDayStartMin(newStart);
      setSlots(items => recalculate(items, newStart));
    }
  };

  const handleDayStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newStart = parseTime(val);
    setDayStartMin(newStart);
    setSlots(items => recalculate(items, newStart));
  };

  // ── DnD ────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSlots(items => {
      const past   = items.filter(s => isPastStatus(s.status));
      const future = items.filter(s => !isPastStatus(s.status));

      const oldIdx = future.findIndex(i => i.id === active.id);
      const newIdx = future.findIndex(i => i.id === over.id);
      const reordered = arrayMove(future, oldIdx, newIdx);

      // Dragging a block updates its anchor to its new sequential position and unpins it
      const dragIdx = reordered.findIndex(i => i.id === active.id);
      if (dragIdx >= 0) {
        const prevEnd = dragIdx === 0 ? dayStartMin : parseTime(reordered[dragIdx - 1].endTime);
        reordered[dragIdx] = {
          ...reordered[dragIdx],
          isPinned: false,
          startTime: formatTime(prevEnd),
          endTime: formatTime(prevEnd + reordered[dragIdx].durationMin),
        };
      }

      return recalculate([...past, ...reordered], dayStartMin);
    });
  };

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: DayManagerSlotUpdate[] = slots.map((s, i) => ({
        id: s.id,
        title: s.title,
        color: s.color,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: i,
        status: s.status,
      }));
      await updateDaySchedule(DEV_WORKSPACE_ID, updates);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background border border-divider/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] relative animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Day Manager</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-full text-foreground/40 hover:text-foreground hover:bg-hover transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Controls Row ───────────────────────────────────────────────── */}
        <div className="px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {!hasActiveBlock && hasFutureBlocks && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-foreground/40" />
                <span className="text-sm font-medium text-foreground/60">Resume at</span>
                <input
                  type="time"
                  value={formatTime(dayStartMin)}
                  onChange={handleDayStartChange}
                  className="bg-transparent rounded-md px-1.5 py-1 text-sm font-mono text-accent outline-none hover:bg-hover focus:bg-hover transition-colors cursor-pointer"
                />
              </div>
            )}
            {hasActiveBlock && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm font-medium text-foreground/60">In progress</span>
              </div>
            )}
          </div>

          <div className="text-sm text-foreground/35 font-medium">
            {futureSlots.filter(s => s.status !== 'ACTIVE').length} remaining
            {futureDuration > 0 && (
              <> • {futureHours}h{futureMinutes > 0 ? ` ${futureMinutes}m` : ''}</>
            )}
          </div>
        </div>

        {/* ── Scrollable Content ─────────────────────────────────────────── */}
        <div className="px-6 py-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-divider">
          {/* Past blocks (read-only) */}
          {hasPastBlocks && (
            <div className="mb-1">
              {pastSlots.map(slot => (
                <PastBlockItem key={slot.id} slot={slot} />
              ))}
            </div>
          )}

          {/* NOW horizon divider */}
          {hasPastBlocks && hasFutureBlocks && <NowDivider />}

          {/* Future blocks (editable, draggable) */}
          {hasFutureBlocks && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={futureSlots.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {futureSlots.map((slot, i) => {
                  // ── Gap detection ──
                  let prevEndMin: number;
                  if (i === 0) {
                    prevEndMin = hasPastBlocks
                      ? parseTime(pastSlots[pastSlots.length - 1].endTime)
                      : dayStartMin;
                  } else {
                    prevEndMin = parseTime(futureSlots[i - 1].endTime);
                  }
                  const currentStartMin = parseTime(slot.startTime);
                  const gapMin = currentStartMin - prevEndMin;

                  // ── Overlap detection ──
                  const overlap =
                    i > 0 &&
                    parseTime(futureSlots[i - 1].endTime) > parseTime(slot.startTime);

                  return (
                    <Fragment key={slot.id}>
                      {gapMin >= 5 && (
                        <GapRow
                          startMin={prevEndMin}
                          endMin={currentStartMin}
                          onFill={() => handleFillGap(i, prevEndMin, currentStartMin)}
                        />
                      )}
                      <SortableItem
                        slot={slot}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        isActive={slot.status === 'ACTIVE'}
                        hasOverlap={overlap}
                      />
                    </Fragment>
                  );
                })}
              </SortableContext>
            </DndContext>
          )}

          {/* No future blocks placeholder */}
          {!hasFutureBlocks && hasPastBlocks && (
            <div className="text-center py-8">
              <p className="text-sm text-foreground/30 font-medium">All blocks completed for today 🎉</p>
              <p className="text-xs text-foreground/20 mt-1">Add new blocks below if needed</p>
            </div>
          )}

          {/* Add block / break row */}
          {isCreating ? (
            <div className="mt-4 p-4 rounded-xl border border-accent/30 bg-accent/5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-accent tracking-wide uppercase flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Create Custom Block
                </span>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-1 rounded-lg hover:bg-hover text-foreground/40 hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title Input */}
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Block Title (e.g. System Design, Gym, Deep Work...)"
                className="w-full bg-background border border-divider/20 rounded-lg px-3 py-2 text-sm font-medium text-foreground outline-none focus:border-accent transition-colors mb-3"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCustomBlock(newTitle || 'New Block', newStartTime || '09:00', newDuration);
                    setIsCreating(false);
                  }
                }}
              />

              {/* Time & Duration Row */}
              <div className="flex items-center gap-4 flex-wrap mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground/60">Start:</span>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="bg-background border border-divider/20 rounded-lg px-2 py-1 text-xs font-mono text-accent outline-none focus:border-accent cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground/60">End:</span>
                  <input
                    type="time"
                    value={formatTime(parseTime(newStartTime || '09:00') + newDuration)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const startMin = parseTime(newStartTime || '09:00');
                        let endMin = parseTime(e.target.value);
                        if (endMin <= startMin) endMin += 24 * 60;
                        setNewDuration(Math.max(15, endMin - startMin));
                      }
                    }}
                    className="bg-background border border-divider/20 rounded-lg px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-accent cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs font-medium text-foreground/60">Duration:</span>
                  <input
                    type="number"
                    value={newDuration || ''}
                    onChange={(e) => setNewDuration(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-14 bg-background border border-divider/20 rounded-lg px-2 py-1 text-xs font-mono text-center outline-none focus:border-accent"
                  />
                  <span className="text-xs font-mono text-foreground/40">m</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                <span className="text-[11px] font-medium text-foreground/40 mr-1">Quick Presets:</span>
                {[
                  { label: '15m', min: 15 },
                  { label: '30m', min: 30 },
                  { label: '45m', min: 45 },
                  { label: '1h', min: 60 },
                  { label: '1.5h', min: 90 },
                  { label: '2h', min: 120 },
                  { label: '3h', min: 180 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setNewDuration(preset.min)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                      newDuration === preset.min
                        ? 'bg-accent text-white border-accent'
                        : 'bg-background hover:bg-hover text-foreground/60 border-divider/15'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleCreateCustomBlock(newTitle || 'New Block', newStartTime || '09:00', newDuration);
                    setIsCreating(false);
                  }}
                  className="px-5 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm"
                >
                  Add to Schedule
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  const future = slots.filter(s => !isPastStatus(s.status));
                  const lastFuture = future[future.length - 1];
                  const start = lastFuture ? parseTime(lastFuture.endTime) : dayStartMin;
                  setNewStartTime(formatTime(start));
                  setNewTitle('');
                  setNewDuration(60);
                  setIsCreating(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-divider/40 text-foreground/45 hover:text-foreground hover:border-accent/40 hover:bg-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Custom Block</span>
              </button>
              <button
                onClick={() => handleAddBlock(true)}
                className="px-5 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-divider/30 text-foreground/35 hover:text-foreground/70 hover:border-foreground/30 hover:bg-hover transition-colors"
              >
                <Coffee className="w-4 h-4" />
                <span className="text-sm font-medium">15m Break</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 shrink-0 flex items-center justify-between border-t border-divider/10">
          {/* Left: triage actions */}
          <div className="flex items-center gap-2">
            {hasFutureBlocks && (
              <button
                onClick={handlePushDelay}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground/50 hover:text-foreground hover:bg-hover transition-colors disabled:opacity-50"
              >
                <FastForward className="w-3.5 h-3.5" />
                {hasActiveBlock ? 'Insert 30m Break' : 'Delay +30m'}
              </button>
            )}
          </div>

          {/* Right: cancel / apply */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* CSS for hiding number-input spinners */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-arrows::-webkit-inner-spin-button,
        .hide-arrows::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-arrows {
          -moz-appearance: textfield;
        }
      `}} />
    </div>
  );
}
