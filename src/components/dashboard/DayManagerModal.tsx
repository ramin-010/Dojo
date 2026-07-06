'use client';

import { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Minus, Settings2, Clock, Coffee } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DayManagerSlotUpdate, updateDaySchedule } from '@/app/actions/schedule-slot.actions';
import { SlotStatus } from '@prisma/client';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

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

type LocalSlot = {
  id: string;
  title: string;
  color: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  status: SlotStatus;
  sortOrder: number;
  durationMin: number;
};

const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#14b8a6', '#6366f1', '#6b7280'];

// ── Helpers ──────────────────────────────────────────────────────────────

const parseTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const format12h = (time24: string): string => {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
};

const formatTime = (min: number) => {
  let m = Math.floor(min);
  if (m < 0) m += 24 * 60;
  if (m >= 24 * 60) m -= 24 * 60;
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

// ── Sortable Item Component ──────────────────────────────────────────────

function SortableItem({ 
  slot, 
  onUpdate,
  onDelete
}: { 
  slot: LocalSlot; 
  onUpdate: (id: string, updates: Partial<LocalSlot>) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const isCompleted = slot.status === 'COMPLETED' || slot.status === 'PARTIAL';
  const isSkipped = slot.status === 'SKIPPED';
  const isBreak = slot.title.toLowerCase().includes('break');

  const cycleColor = () => {
    if (isCompleted || isSkipped) return;
    const idx = PRESET_COLORS.indexOf(slot.color);
    const next = PRESET_COLORS[(idx + 1) % PRESET_COLORS.length];
    onUpdate(slot.id, { color: next });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 p-2 rounded-xl border border-transparent mb-1 transition-colors ${isDragging ? 'shadow-xl opacity-90 border-accent/20 bg-hover' : 'hover:bg-hover'} ${isCompleted ? 'opacity-50 grayscale' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 text-foreground/30 hover:text-foreground/70 outline-none transition-colors"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <button 
        onClick={cycleColor}
        className="w-2 h-10 rounded-full shrink-0 transition-transform active:scale-90 cursor-pointer" 
        style={{ backgroundColor: slot.color }} 
        title="Click to change color"
      />

      <div className="flex-1 min-w-0 flex flex-col gap-1 py-1">
        <input 
          value={slot.title}
          onChange={(e) => onUpdate(slot.id, { title: e.target.value })}
          disabled={isCompleted || isSkipped}
          placeholder="Block Title"
          className={`bg-transparent outline-none w-full text-sm font-semibold transition-colors placeholder:text-foreground/20 focus:text-accent ${isSkipped ? 'line-through text-foreground/40' : (isBreak ? 'text-foreground/50' : 'text-foreground/90')}`}
        />
        <div className="flex items-center gap-2">
          <p className="text-xs font-mono text-foreground/50">
            {format12h(slot.startTime)} - {format12h(slot.endTime)}
          </p>
        </div>
      </div>

      {!isCompleted && !isSkipped && (
        <div className="flex items-center gap-2 pr-1 opacity-60 group-hover:opacity-100 transition-opacity">
          {/* Duration Minimal Input */}
          <div className="flex items-center bg-background/50 rounded-lg px-1 py-1 focus-within:bg-background transition-colors">
            <button onClick={() => onUpdate(slot.id, { durationMin: Math.max(5, slot.durationMin - 15) })} className="p-1 hover:text-accent text-foreground/50 transition-colors"><Minus className="w-3 h-3"/></button>
            <input 
              type="number" 
              value={slot.durationMin || ''}
              onChange={(e) => onUpdate(slot.id, { durationMin: Math.max(5, parseInt(e.target.value) || 5) })}
              className="w-10 bg-transparent text-xs font-mono text-center outline-none text-foreground/80 hide-arrows"
            />
            <span className="text-xs font-mono text-foreground/40 pr-1">m</span>
            <button onClick={() => onUpdate(slot.id, { durationMin: slot.durationMin + 15 })} className="p-1 hover:text-accent text-foreground/50 transition-colors"><Plus className="w-3 h-3"/></button>
          </div>
          
          <div className="w-px h-5 bg-divider/40 mx-1" />

          <button
            onClick={() => onUpdate(slot.id, { status: 'SKIPPED' })}
            className="px-2 py-1 rounded-lg hover:bg-hover text-xs font-medium text-foreground/50 hover:text-foreground transition-colors outline-none"
            title="Skip block"
          >
            Skip
          </button>

          <button
            onClick={() => onDelete(slot.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-400 transition-colors outline-none"
            title="Remove block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function DayManagerModal({ isOpen, onClose, initialSlots }: DayManagerModalProps) {
  const [slots, setSlots] = useState<LocalSlot[]>([]);
  const [dayStartMin, setDayStartMin] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const parsed = initialSlots.map(s => {
        let dur = parseTime(s.endTime) - parseTime(s.startTime);
        if (dur <= 0) dur += 24 * 60;
        return { ...s, durationMin: dur };
      }).sort((a, b) => a.sortOrder - b.sortOrder);
      
      setSlots(parsed);
      if (parsed.length > 0) {
        setDayStartMin(parseTime(parsed[0].startTime));
      } else {
        setDayStartMin(parseTime(formatTime(new Date().getHours() * 60)));
      }
    }
  }, [isOpen, initialSlots]);

  const recalculateTimes = (currentSlots: LocalSlot[], startBaseMin: number) => {
    if (currentSlots.length === 0) return currentSlots;
    let currentMin = startBaseMin;
    return currentSlots.map((slot, idx) => {
      const newStart = currentMin;
      const newEnd = currentMin + slot.durationMin;
      const res = { ...slot, startTime: formatTime(newStart), endTime: formatTime(newEnd), sortOrder: idx };
      currentMin = newEnd;
      return res;
    });
  };

  const handleDayStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newStart = parseTime(val);
    setDayStartMin(newStart);
    setSlots(items => recalculateTimes(items, newStart));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSlots((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return recalculateTimes(reordered, dayStartMin);
      });
    }
  };

  const handleUpdate = (id: string, updates: Partial<LocalSlot>) => {
    setSlots(items => {
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return items;
      const updated = [...items];
      updated[idx] = { ...updated[idx], ...updates };
      
      // If duration changed, recalculate
      if (updates.durationMin !== undefined) {
        return recalculateTimes(updated, dayStartMin);
      }
      return updated;
    });
  };

  const handleDelete = (id: string) => {
    setSlots(items => recalculateTimes(items.filter(i => i.id !== id), dayStartMin));
  };

  const handleAddBlock = (isBreak: boolean = false) => {
    setSlots(items => {
      const startMin = items.length > 0 ? parseTime(items[items.length - 1].endTime) : dayStartMin;
      const newSlot: LocalSlot = {
        id: `new-${Date.now()}`,
        title: isBreak ? 'Break' : 'New Block',
        color: isBreak ? '#6b7280' : '#8b5cf6',
        startTime: formatTime(startMin),
        endTime: formatTime(startMin + (isBreak ? 15 : 60)),
        status: 'UPCOMING',
        sortOrder: items.length,
        durationMin: isBreak ? 15 : 60,
      };
      return recalculateTimes([...items, newSlot], dayStartMin);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: DayManagerSlotUpdate[] = slots.map(s => ({
        id: s.id,
        title: s.title,
        color: s.color,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: s.sortOrder,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-background border border-divider/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Day Manager</h2>
            </div>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-2 rounded-full text-foreground/40 hover:text-foreground hover:bg-hover transition-colors disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Controls */}
        <div className="px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-foreground/50" />
            <span className="text-sm font-medium text-foreground/70">Timeline starts at</span>
            <input 
              type="time" 
              value={formatTime(dayStartMin)}
              onChange={handleDayStartChange}
              className="bg-transparent rounded-md px-1 py-1 text-sm font-mono text-accent outline-none hover:bg-hover focus:bg-hover transition-colors ml-1 cursor-pointer"
            />
          </div>
          <div className="text-sm text-foreground/40 font-medium">
            {slots.length} blocks • {Math.floor(slots.reduce((acc, s) => acc + s.durationMin, 0) / 60)}h {slots.reduce((acc, s) => acc + s.durationMin, 0) % 60}m
          </div>
        </div>

        {/* Sortable List */}
        <div className="px-6 py-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-divider">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={slots.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {slots.map(slot => (
                <SortableItem key={slot.id} slot={slot} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </SortableContext>
          </DndContext>
          
          <div className="mt-4 flex gap-3">
            <button onClick={() => handleAddBlock(false)} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-divider/40 text-foreground/50 hover:text-foreground hover:border-accent/40 hover:bg-hover transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Block</span>
            </button>
            <button onClick={() => handleAddBlock(true)} className="px-5 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-divider/30 text-foreground/40 hover:text-foreground/70 hover:border-foreground/30 hover:bg-hover transition-colors">
              <Coffee className="w-4 h-4" />
              <span className="text-sm font-medium">Break</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 shrink-0 flex justify-end gap-3">
          <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-hover transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50">
            {isSaving ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
      </div>
      
      {/* CSS for hiding number input arrows */}
      <style dangerouslySetInnerHTML={{__html: `
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
