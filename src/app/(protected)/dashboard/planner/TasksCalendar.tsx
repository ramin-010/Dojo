'use client';

import { useState, useEffect, useTransition } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Calendar as CalendarIcon, Circle, Plus, ListTodo, X, Zap, BookOpen } from 'lucide-react';
import { getDay, getDaysInMonth, startOfMonth, format, isToday, isBefore, startOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toggleRevision, getTasksAndRevisionsForMonth } from '@/app/actions/planner.actions';
import { createCapture, toggleTaskStatus, deleteCapture } from '@/app/actions';
import { TaskActionMenu } from '@/components/dashboard/TaskActionMenu';
import { ReplaceBlockModal } from '@/components/dashboard/ReplaceBlockModal';
import { MoreHorizontal, SkipForward, ArrowRightLeft } from 'lucide-react';
import { logSession } from '@/app/actions/planner.actions';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const format12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
};

interface TasksCalendarProps {
  initialTasks: any[];
  initialRevisions: any[];
  initialBlocks: any[];
  initialRoutineMode?: 'MASTER' | 'DAILY';
  mode?: 'default' | 'reschedule';
  rescheduleTargetName?: string;
  onReschedule?: (date: Date) => void;
  isRescheduling?: boolean;
  onRescheduleItem?: (target: { id: string, type: 'task' | 'revision' | 'reminder', title: string }) => void;
  refreshTrigger?: number;
}

export default function TasksCalendar({ 
  initialTasks = [], 
  initialRevisions = [], 
  initialBlocks = [],
  initialRoutineMode = 'DAILY',
  mode = 'default',
  rescheduleTargetName = '',
  onReschedule,
  isRescheduling = false,
  onRescheduleItem,
  refreshTrigger = 0,
}: TasksCalendarProps) {
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  
  // Block action state
  const [activeBlockMenuId, setActiveBlockMenuId] = useState<string | null>(null);
  const [replaceTargetBlock, setReplaceTargetBlock] = useState<any | null>(null);
  
  const router = useRouter();

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      return newSet;
    });
  };

  // Data state
  const [tasks, setTasks] = useState(initialTasks);
  const [revisions, setRevisions] = useState(initialRevisions);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const todayStart = startOfDay(new Date());
  const isSelectedDateInPast = isBefore(startOfDay(selectedDate), todayStart);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const data = await getTasksAndRevisionsForMonth(year, month);
        if (mounted) {
          setTasks(data.tasks);
          setRevisions(data.revisions);
        }
      } catch (error) {
        console.error("Failed to fetch planner data:", error);
      } finally {
        if (mounted) setIsLoadingData(false);
      }
    };
    
    // Only fetch if we are not in the initial month/year that we were provided props for,
    // OR if we are in a mode where initial props might be incomplete (like Dashboard -> RescheduleModal).
    // Actually, to be safe and ensure data is always accurate, we can just fetch whenever year/month changes.
    // If it's the exact same data, React won't re-render anyway.
    fetchData();

    return () => { mounted = false; };
  }, [year, month, refreshTrigger]);

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getDay(startOfMonth(currentDate)); // 0 = Sun, 1 = Mon, etc.

  // Helper to handle month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Determine tasks/revisions for the currently selected date
  const selectedDayRevisions = revisions.filter(r => {
    if (!r.scheduledFor) return false;
    const date = new Date(r.scheduledFor);
    return date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
  }).sort((a, b) => {
    const aDone = a.status === 'done';
    const bDone = b.status === 'done';
    return Number(aDone) - Number(bDone);
  });

  const selectedDayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const date = new Date(t.dueDate);
    const isSameDay = date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
    if (!isSameDay) return false;

    // Prevent duplicates: if this task is a Capture that ALREADY has a Revision scheduled for today, don't show it as a standalone task.
    const captureId = t.captureId || t.id;
    const isDuplicate = selectedDayRevisions.some(r => r.capture?.id === captureId);
    
    return !isDuplicate;
  }).sort((a, b) => {
    const aDone = a.status === 'done' || a.isDone;
    const bDone = b.status === 'done' || b.isDone;
    return Number(aDone) - Number(bDone);
  });

  const selectedDayOfWeek = selectedDate.getDay(); // 0 is Sunday, 1 is Monday. Wait, in Timetable DAYS array: Mon=0, Tue=1 ... Sun=6.
  // We need to map JS getDay() (0=Sun) to our 0=Mon indexing if we want to match initialBlocks dayOfWeek.
  // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Timetable: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  const mappedDayOfWeek = selectedDayOfWeek === 0 ? 6 : selectedDayOfWeek - 1;

  const selectedDayBlocks = initialRoutineMode === 'MASTER'
    ? initialBlocks.filter(b => b.dayOfWeek === null)
    : initialBlocks.filter(b => b.dayOfWeek === mappedDayOfWeek);

  const totalUpcoming = selectedDayTasks.filter(t => !t.isDone).length + selectedDayRevisions.filter(r => r.status === 'pending').length;

  return (
    <div className="flex h-full gap-8 max-w-5xl mx-auto">
      {/* ── Left Pane: Minimal Calendar Picker ────────────────────────────── */}
      <div className="w-[320px] flex-shrink-0 flex flex-col pt-2">
        
        <div className="flex justify-between items-center mb-8 px-2">
          <h2 className="text-[17px] font-bold text-foreground tracking-tight">{format(currentDate, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 text-foreground/40 hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-1 text-foreground/40 hover:text-foreground transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-4">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        
        <div className={`grid grid-cols-7 gap-y-3 gap-x-1 transition-opacity duration-300 ${isLoadingData ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Empty slots for days before the 1st of the month */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Actual days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const thisDate = new Date(year, month, dayNum);
            const isSelected = selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
            const isTodayDate = isToday(thisDate);
            const isPastDate = isBefore(startOfDay(thisDate), todayStart);
            
            // Check if this day has tasks or revisions
            const hasActivity = tasks.some(t => {
              if (!t.dueDate) return false;
              const d = new Date(t.dueDate);
              return d.getDate() === dayNum && d.getMonth() === month && d.getFullYear() === year;
            }) || revisions.some(r => {
              if (!r.scheduledFor) return false;
              const d = new Date(r.scheduledFor);
              return d.getDate() === dayNum && d.getMonth() === month && d.getFullYear() === year;
            });

            return (
              <div key={dayNum} className="flex flex-col items-center justify-center">
                <button 
                  onClick={() => setSelectedDate(thisDate)}
                  className={`
                    w-9 h-9 flex items-center justify-center rounded-full text-[13px] font-medium transition-all relative
                    ${isPastDate && !isSelected && !isTodayDate ? 'opacity-40 hover:opacity-100' : ''}
                    ${isSelected 
                      ? 'bg-foreground text-background shadow-md' 
                      : isTodayDate
                        ? 'text-accent hover:bg-accent/10'
                        : 'text-foreground/70 hover:bg-hover hover:text-foreground'}
                  `}
                >
                  {dayNum}
                  {hasActivity && !isSelected && (
                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent/60" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Right Pane: Daily Agenda ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col pt-2 pb-32 pr-6 overflow-y-auto max-w-2xl">
        
        <div className="flex justify-between items-end mb-10">
          <div>
            <h3 className="text-2xl font-bold text-foreground tracking-tight">{format(selectedDate, 'EEEE, MMMM d')}</h3>
            <p className="text-[13px] text-foreground/50 mt-1">{totalUpcoming} upcoming task{totalUpcoming === 1 ? '' : 's'}</p>
          </div>
          {mode === 'default' ? (
            !isSelectedDateInPast && (
              <button onClick={() => setIsAddingTask(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors text-[13px] font-semibold shadow-sm">
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            )
          ) : (
            <button 
              onClick={() => onReschedule && onReschedule(selectedDate)} 
              disabled={isRescheduling}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors text-[13px] font-semibold shadow-sm disabled:opacity-50"
            >
              {isRescheduling ? 'Moving...' : `Move here`}
            </button>
          )}
        </div>

        {mode === 'reschedule' && (
          <div className="mb-8 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-3">
            <CalendarIcon className="w-4 h-4 text-accent" />
            <p className="text-[13px] font-medium text-accent">
              Rescheduling <strong className="font-bold">{rescheduleTargetName}</strong> to {format(selectedDate, 'MMMM d')}
            </p>
          </div>
        )}

        <div className="space-y-12">
          {/* Scheduled Blocks */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="w-4 h-4 text-foreground/30" />
              <h4 className="text-[13px] font-semibold text-foreground/70">Scheduled Routine</h4>
            </div>
            {selectedDayBlocks.length > 0 ? (
              <div className="space-y-3">
                {selectedDayBlocks.map(block => (
                  <div key={block.id} className="group relative flex items-start gap-4 p-4 rounded-xl bg-sidebar border border-divider hover:bg-hover transition-colors">
                    <div className="w-2 h-2 rounded-full mt-1.5 opacity-80 flex-shrink-0" style={{ backgroundColor: block.color || '#3b82f6' }} />
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-foreground/90 leading-tight">{block.title}</p>
                      <p className="text-[11px] font-mono text-foreground/40 mt-1">{format12h(block.startTime)} - {format12h(block.endTime)}</p>
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveBlockMenuId(activeBlockMenuId === block.id ? null : block.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-foreground/40 hover:text-foreground transition-all rounded-md hover:bg-white/5"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {activeBlockMenuId === block.id && (
                      <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setActiveBlockMenuId(null)} />
                        <div className="absolute top-10 right-4 z-[9999] bg-black border border-white/20 rounded-xl p-1 shadow-[0_16px_40px_rgba(0,0,0,1)] min-w-[160px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                          <button 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              setActiveBlockMenuId(null);
                              const remark = window.prompt(`Reason for pre-skipping ${block.title}?`);
                              if (remark) {
                                await logSession(block.id, selectedDate, 'SKIPPED', remark);
                                router.refresh();
                              }
                            }}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors w-full text-left group/item"
                          >
                            <SkipForward className="w-[15px] h-[15px] text-accent/80 group-hover/item:text-accent" />
                            <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">Pre-Skip</span>
                          </button>
                          
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveBlockMenuId(null);
                              setReplaceTargetBlock(block);
                            }}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors w-full text-left group/item"
                          >
                            <ArrowRightLeft className="w-[15px] h-[15px] text-emerald-500/80 group-hover/item:text-emerald-500" />
                            <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">Replace / Shift</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-foreground/40 italic px-2">No routines scheduled for today.</div>
            )}
          </section>

          {/* Tasks List */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ListTodo className="w-4 h-4 text-foreground/30" />
              <h4 className="text-[13px] font-semibold text-foreground/70">Tasks & Revisions</h4>
            </div>
            <div className="space-y-3">
              
              {isLoadingData ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-sidebar border border-divider">
                      <div className="w-5 h-5 rounded-full bg-foreground/10 mt-0.5 shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-foreground/10 rounded w-3/4" />
                        <div className="h-3 bg-foreground/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {isAddingTask && (
                    <AddTaskForm selectedDate={selectedDate} onCancel={() => setIsAddingTask(false)} />
                  )}

                  {selectedDayRevisions.map(rev => {
                    const isDone = rev.status === 'done';
                return (
                  <div 
                    key={rev.id} 
                    onClick={() => {
                      if (!rev.capture) {
                        const subjId = rev.topic?.subject?.id || 'general';
                        const topId = rev.topic?.id;
                        if (topId) {
                          router.push(`/dashboard/subject/${subjId}/topic/${topId}`);
                        }
                      } else {
                        toggleTaskExpansion(rev.id);
                      }
                    }}
                    className={`group flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${isDone ? 'bg-transparent border-transparent opacity-50' : 'bg-sidebar border-divider hover:border-foreground/20'} ${actionMenuId === rev.id ? 'relative z-50' : ''}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <TaskActionMenu 
                        task={rev}
                        isOpen={actionMenuId === rev.id}
                        onToggle={() => toggleRevision(rev.id, !isDone)}
                        onReschedule={() => {
                          if (onRescheduleItem) {
                            onRescheduleItem({ id: rev.id, type: 'revision', title: rev.topic?.title || rev.capture?.title || rev.capture?.content?.substring(0, 50) || 'Unknown Revision' });
                          }
                          setActionMenuId(null);
                        }}
                        onOpen={(e) => { e.stopPropagation(); setActionMenuId(rev.id); }}
                        onClose={() => setActionMenuId(null)}
                        circleColorClass="text-accent/60"
                        hoverColorClass="group-hover/btn:text-accent group-hover:text-accent"
                        sizeClass="w-5 h-5"
                        labels={{ complete: "Complete Revision", reschedule: "Reschedule" }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[14px] font-medium leading-tight ${isDone ? 'text-foreground/50 line-through' : 'text-foreground/90'} ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'}`}>
                        {rev.topic?.title || rev.capture?.title || rev.capture?.content?.substring(0, 50) || 'Unknown Revision'}
                      </p>
                      {expandedTaskIds.has(rev.id) && rev.capture?.content && rev.capture.content !== rev.capture.title && (
                        <p className={`text-[13px] mt-2 whitespace-pre-wrap ${isDone ? 'text-foreground/30' : 'text-foreground/60'}`}>
                          {rev.capture.content}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-accent/10 text-accent">
                          Spaced Repetition
                        </span>
                        <span className="text-foreground/20 mx-0.5">•</span>
                        {rev.capture ? (
                          <span className="flex items-center gap-1 text-[11px] text-foreground/40"><Zap className="w-3 h-3" /> Note</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-foreground/40"><BookOpen className="w-3 h-3" /> Topic</span>
                        )}
                        <span className="text-foreground/20 mx-0.5">•</span>
                        <span className="text-[11px] text-foreground/50 text-medium">Cycle {rev.cycleNumber}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {selectedDayTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  actionMenuId={actionMenuId}
                  setActionMenuId={setActionMenuId}
                  onRescheduleItem={onRescheduleItem}
                  isExpanded={expandedTaskIds.has(task.id)}
                  onToggleExpand={() => toggleTaskExpansion(task.id)}
                />
              ))}

              {selectedDayTasks.length === 0 && selectedDayRevisions.length === 0 && !isAddingTask && (
                <div className="text-[13px] text-foreground/40 italic px-2 py-4">No tasks or revisions due today.</div>
              )}
                </>
              )}
            </div>
          </section>
        </div>
        
      </div>
      
      <ReplaceBlockModal 
        isOpen={!!replaceTargetBlock}
        onClose={() => setReplaceTargetBlock(null)}
        targetBlock={replaceTargetBlock}
        targetDate={selectedDate}
      />
    </div>
  );
}

function TaskItem({ 
  task, 
  actionMenuId, 
  setActionMenuId, 
  onRescheduleItem,
  isExpanded,
  onToggleExpand
}: { 
  task: any,
  actionMenuId: string | null,
  setActionMenuId: (id: string | null) => void,
  onRescheduleItem?: (target: { id: string, type: 'task' | 'revision', title: string }) => void,
  isExpanded?: boolean,
  onToggleExpand?: () => void
}) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleTaskStatus(task.id, !task.isDone);
    });
  };

  return (
    <div 
      className={`group flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${task.isDone ? 'bg-transparent border-transparent opacity-50' : 'bg-transparent border-divider/40 hover:border-foreground/20'} ${actionMenuId === task.id ? 'relative z-50' : ''}`}
      onClick={(e) => {
        // Prevent opening if clicking on the circle menu itself
        if ((e.target as Element).closest('.task-action-menu-container')) return;
        if (onToggleExpand) onToggleExpand();
      }}
    >
      <div className="mt-0.5 flex-shrink-0 task-action-menu-container">
        <TaskActionMenu 
          task={task}
          isOpen={actionMenuId === task.id}
          onToggle={handleToggle}
          onReschedule={() => {
            if (onRescheduleItem) {
              onRescheduleItem({ id: task.id, type: 'task', title: task.title });
            }
            setActionMenuId(null);
          }}
          onOpen={(e) => { e.stopPropagation(); setActionMenuId(task.id); }}
          onClose={() => setActionMenuId(null)}
          circleColorClass="text-foreground/30"
          hoverColorClass="group-hover/btn:text-accent group-hover:text-foreground/50"
          sizeClass="w-5 h-5"
        />
      </div>
      <div className="flex-1">
        <p className={`text-[14px] font-medium leading-tight ${task.isDone ? 'text-foreground/50 line-through' : 'text-foreground/90'} ${isExpanded ? '' : 'line-clamp-2'}`}>
          {task.title || task.content?.substring(0, 50) || 'Unknown Task'}
        </p>
        {isExpanded && task.content && task.content !== task.title && (
          <p className={`text-[13px] mt-2 whitespace-pre-wrap ${task.isDone ? 'text-foreground/30' : 'text-foreground/60'}`}>
            {task.content}
          </p>
        )}
        {task.reminderTime && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">
              Reminder
            </span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-foreground/30" />
              <span className="text-[11px] font-mono text-foreground/40">{task.reminderTime}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddTaskForm({ selectedDate, onCancel }: { selectedDate: Date, onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      // Due date is set to midnight of the selected date (or could be 23:59)
      const dueDate = new Date(selectedDate);
      dueDate.setHours(23, 59, 59, 999);

      await createCapture({
        title,
        explicitDate: dueDate,
        explicitType: 'task',
      });
      onCancel();
    });
  };

  return (
    <div className="bg-sidebar border border-divider rounded-xl p-4 flex items-center gap-3">
      <div className="mt-0.5 flex-shrink-0 text-foreground/20">
        <Circle className="w-5 h-5" />
      </div>
      <div className="flex-1 flex items-center gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="What needs to be done?"
          className="w-full bg-transparent text-[14px] font-medium text-foreground focus:outline-none placeholder:text-foreground/30"
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onCancel} className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSave} 
            disabled={!title.trim() || isPending}
            className="px-3 py-1.5 bg-foreground text-background rounded-md text-[12px] font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? '...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
