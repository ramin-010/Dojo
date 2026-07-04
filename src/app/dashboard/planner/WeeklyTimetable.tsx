'use client';

import { useState, useTransition } from 'react';
import { Plus, MoreHorizontal, CalendarDays, X, Trash2 } from 'lucide-react';
import { createTimeBlock, deleteTimeBlock, updateRoutineMode } from '@/app/actions/planner.actions';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const format12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
};

export default function WeeklyTimetable({ initialBlocks = [], initialRoutineMode }: { initialBlocks?: any[], initialRoutineMode: 'MASTER' | 'DAILY' }) {
  const [isPending, startTransition] = useTransition();
  const [sameForAll, setSameForAll] = useState(initialRoutineMode === 'MASTER');
  const [addingDay, setAddingDay] = useState<number | 'master' | null>(null);

  const masterBlocks = initialBlocks.filter(b => b.dayOfWeek === null);

  const handleToggleMode = () => {
    const newMode = !sameForAll;
    setSameForAll(newMode);
    startTransition(async () => {
      await updateRoutineMode(newMode ? 'MASTER' : 'DAILY');
    });
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* ── Floating Controls ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <label onClick={handleToggleMode} className={`flex items-center gap-2 cursor-pointer group ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className={`w-8 h-4 rounded-full transition-colors relative flex items-center ${sameForAll ? 'bg-accent' : 'bg-divider'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute ${sameForAll ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-[13px] font-medium transition-colors ${sameForAll ? 'text-foreground' : 'text-foreground/50 group-hover:text-foreground/70'}`}>
              Same routine every day
            </span>
          </label>
        </div>
      </div>

      {/* ── Board Area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto pb-4">
        {sameForAll ? (
          /* Single Master Routine Column */
          <div className="max-w-md mx-auto w-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground/80">Master Daily Routine</span>
            </div>
            <div className="flex flex-col gap-3">
              {masterBlocks.map(block => (
                <BlockCard key={block.id} block={block} />
              ))}
              
              {addingDay === 'master' ? (
                <AddBlockForm dayOfWeek={null} onCancel={() => setAddingDay(null)} />
              ) : (
                <AddBlockButton onClick={() => setAddingDay('master')} />
              )}
            </div>
          </div>
        ) : (
          /* 7-Column Kanban */
          <div className="flex gap-6 min-w-max">
            {DAYS.map((day, dayIndex) => {
              const dayBlocks = initialBlocks.filter(b => b.dayOfWeek === dayIndex);
              
              return (
                <div key={day} className="w-[260px] flex flex-col">
                  {/* Floating Day Header */}
                  <div className="mb-4 pl-1">
                    <span className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">{day}</span>
                  </div>
                  
                  {/* Blocks List */}
                  <div className="flex flex-col gap-3">
                    {dayBlocks.length > 0 ? (
                      dayBlocks.map(block => (
                        <BlockCard key={block.id} block={block} />
                      ))
                    ) : (
                      !addingDay && (
                        <div className="flex items-center justify-center border border-dashed border-divider/40 rounded-xl opacity-50 p-4 text-center">
                          <p className="text-[11px] font-medium text-foreground/30">No blocks</p>
                        </div>
                      )
                    )}
                    
                    {addingDay === dayIndex ? (
                      <AddBlockForm dayOfWeek={dayIndex} onCancel={() => setAddingDay(null)} />
                    ) : (
                      <AddBlockButton onClick={() => setAddingDay(dayIndex)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockCard({ block }: { block: any }) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTimeBlock(block.id);
    } catch(e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  return (
    <div className={`group relative bg-sidebar border border-divider rounded-xl p-3.5 hover:bg-hover transition-colors ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: block.color || '#3b82f6', opacity: 0.8 }} />
          <div>
            <p className="text-[13px] font-semibold text-foreground/90 leading-tight">{block.title}</p>
            <p className="text-[11px] font-mono text-foreground/40 mt-1">{format12h(block.startTime)} - {format12h(block.endTime)}</p>
          </div>
        </div>
        <button onClick={handleDelete} className="text-foreground/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddBlockButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full py-2 flex items-center justify-center gap-1.5 rounded-xl border border-transparent hover:border-divider/50 hover:bg-hover/30 text-foreground/30 hover:text-foreground/60 text-[11px] font-semibold transition-all">
      <Plus className="w-3.5 h-3.5" />
      Add Block
    </button>
  );
}

function AddBlockForm({ dayOfWeek, onCancel }: { dayOfWeek: number | null, onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await createTimeBlock({
        title,
        startTime: start,
        endTime: end,
        color: '#007acc',
        dayOfWeek,
      });
      onCancel();
    });
  };

  return (
    <div className="bg-sidebar border border-divider rounded-xl p-3.5 space-y-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent" />
      <div className="pl-1 space-y-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Block Title..."
          className="w-full bg-transparent text-[14px] font-semibold text-foreground focus:outline-none placeholder:text-foreground/30"
        />
        <div className="flex items-center gap-2">
          <input 
            type="time" 
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-transparent border border-divider/50 rounded-md px-2 py-1.5 text-[12px] font-mono text-foreground/90 focus:outline-none focus:border-accent [&::-webkit-calendar-picker-indicator]:opacity-30 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-60 transition-colors"
          />
          <span className="text-foreground/30 text-[11px] font-bold">to</span>
          <input 
            type="time" 
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-transparent border border-divider/50 rounded-md px-2 py-1.5 text-[12px] font-mono text-foreground/90 focus:outline-none focus:border-accent [&::-webkit-calendar-picker-indicator]:opacity-30 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-60 transition-colors"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-divider/40">
          <button onClick={onCancel} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSave} 
            disabled={!title.trim() || isPending}
            className="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving...' : 'Save Block'}
          </button>
        </div>
      </div>
    </div>
  );
}
