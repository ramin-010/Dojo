// 'use client';

// import { useState, useMemo, useEffect } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import {
//   Clock,
//   CheckCircle2,
//   Circle,
//   AlertCircle,
//   Flame,
//   BookOpen,
//   ChevronRight,
//   ChevronDown,
//   Play,
//   Calendar,
//   Bell,
//   ExternalLink,
//   FileText,
//   Link2,
//   ArrowRight,
//   TrendingUp,
//   MoreHorizontal,
//   Target,
//   Zap,
//   Plus,
//   Mic,
//   AudioLines,
//   FolderPlus,
//   X,
//   CalendarIcon,
//   Paperclip,
//   Inbox
// } from 'lucide-react';
// import { CreateSubjectModal } from '@/components/subject/CreateSubjectModal';
// import RescheduleModal from '@/components/dashboard/RescheduleModal';
// import { TaskActionMenu } from '@/components/dashboard/TaskActionMenu';
// import { ResourcePreviewModal } from '@/app/topic/[id]/components/resources/ResourcePreviewModal';
// import { TriageInterceptor } from '@/components/dashboard/TriageInterceptor';
// import { ActiveBlockActions } from '@/components/dashboard/ActiveBlockActions';
// // ────────────────────────────────────────────────────────────────────────────────
// // TYPES & PROPS
// // ────────────────────────────────────────────────────────────────────────────────

// interface RevisionProp {
//   id: string;
//   topicId: string;
//   topicTitle: string;
//   subjectId: string;
//   subjectName: string;
//   subjectColor: string;
//   cycleNumber: number;
//   intervalDays: number;
//   scheduledFor: Date;
//   status: 'pending' | 'overdue';
//   tags: string[];
//   isQuickNote: boolean;
//   isDone: boolean;
//   description?: string | null;
//   attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
// }

// interface TaskProp {
//   id: string;
//   title: string;
//   isDone: boolean;
//   time?: string | null;
//   dueDate?: Date | null;
//   type: 'reminder' | 'task';
//   isOverdue?: boolean;
//   source?: string;
//   description?: string | null;
//   tags?: string[];
//   attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
// }

// interface InboxProp {
//   id: string;
//   type: 'link' | 'note' | 'file';
//   title: string;
//   url?: string;
//   createdAt: Date;
//   isPinned?: boolean;
//   tags: string[];
//   attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
// }

// interface StatsProp {
//   streak: number;
//   totalTopics: number;
//   totalRevisionsDone: number;
//   weeklyActivity: number[];
//   mastered: number;
//   inProgress: number;
//   notStarted: number;
// }

// interface ScheduleBlockProp {
//   id: string;
//   title: string;
//   startTime: string;
//   endTime: string;
//   color: string;
//   sessionLogs?: any[];
// }

// interface DashboardClientProps {
//   revisions: RevisionProp[];
//   tasks: TaskProp[];
//   inbox: InboxProp[];
//   stats: StatsProp;
//   scheduleBlocks: ScheduleBlockProp[];
//   initialRoutineMode: 'MASTER' | 'DAILY';
//   unverifiedBlocks?: any[];
// }

// const MOCK_USER = { name: 'Ramin' };

// // ────────────────────────────────────────────────────────────────────────────────
// // HELPERS
// // ────────────────────────────────────────────────────────────────────────────────

// function getGreeting(): string {
//   const h = new Date().getHours();
//   if (h < 12) return 'Good morning';
//   if (h < 17) return 'Good afternoon';
//   return 'Good evening';
// }

// function getCycleName(intervalDays: number): string {
//   if (intervalDays === 1) return 'Day 1';
//   if (intervalDays === 3) return 'Day 3';
//   if (intervalDays === 7) return 'Day 7';
//   if (intervalDays === 21) return 'Day 21';
//   return `Day ${intervalDays}`;
// }

// function getDuration(start: string, end: string): string {
//   const [sh, sm] = start.split(':').map(Number);
//   const [eh, em] = end.split(':').map(Number);
//   const mins = (eh * 60 + em) - (sh * 60 + sm);
//   const h = Math.floor(mins / 60);
//   const m = mins % 60;
//   return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
// }

// function format12h(time24: string): string {
//   const [h, m] = time24.split(':').map(Number);
//   const ampm = h >= 12 ? 'PM' : 'AM';
//   const h12 = h % 12 || 12;
//   return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
// }

// // ────────────────────────────────────────────────────────────────────────────────
// // MAIN COMPONENT
// // ────────────────────────────────────────────────────────────────────────────────

// export default function DashboardClient({ 
//   revisions = [], 
//   tasks: initialTasks = [], 
//   inbox: rawInbox = [], 
//   stats, 
//   scheduleBlocks = [],
//   initialRoutineMode,
//   unverifiedBlocks = []
// }: DashboardClientProps) {
//   const router = useRouter();
//   const [showOverdue, setShowOverdue] = useState(true);
//   const [tasks, setTasks] = useState(initialTasks);
//   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
//   const [isAllTasksModalOpen, setIsAllTasksModalOpen] = useState(false);
//   const [activeTaskTab, setActiveTaskTab] = useState<'overdue' | 'today' | 'upcoming'>('today');
//   const [taskActionMenuId, setTaskActionMenuId] = useState<string | null>(null);
//   const [rescheduleTaskTarget, setRescheduleTaskTarget] = useState<any | null>(null);
//   const [previewDocument, setPreviewDocument] = useState<{ id: string; title: string; url: string; category: 'file' | 'image' | 'link'; thumbnailUrl?: string; addedAt: string; } | null>(null);
//   const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

//   // Deduplicate items based on priority: Revisions > Tasks > Inbox
//   const activeRevisionCaptureIds = useMemo(() => new Set(revisions.map((r: any) => r.capture?.id).filter(Boolean)), [revisions]);
//   const filteredTasks = useMemo(() => tasks.filter((t: any) => !activeRevisionCaptureIds.has(t.captureId || t.id)), [tasks, activeRevisionCaptureIds]);
//   const activeTaskCaptureIds = useMemo(() => new Set(filteredTasks.map((t: any) => t.captureId || t.id).filter(Boolean)), [filteredTasks]);
//   const filteredInbox = useMemo(() => rawInbox.filter((note: any) => !activeRevisionCaptureIds.has(note.id) && !activeTaskCaptureIds.has(note.id)), [rawInbox, activeRevisionCaptureIds, activeTaskCaptureIds]);

//   // Group tasks
//   const now = new Date();
//   const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

//   const undoneTasks = filteredTasks.filter(t => !t.isDone);
//   const overdueTasks = filteredTasks.filter(t => t.isOverdue).sort((a, b) => Number(a.isDone) - Number(b.isDone));
//   const todayTasks = filteredTasks.filter(t => {
//     if (!t.dueDate) return true; // No due date -> show in today/inbox conceptually
//     const d = new Date(t.dueDate);
//     return d >= startOfToday && d <= endOfToday;
//   }).sort((a, b) => Number(a.isDone) - Number(b.isDone));
//   const upcomingTasks = filteredTasks.filter(t => {
//     if (!t.dueDate) return false;
//     const d = new Date(t.dueDate);
//     return d > endOfToday;
//   }).sort((a, b) => Number(a.isDone) - Number(b.isDone));

//   const tasksToShow = todayTasks.length > 0 ? todayTasks : upcomingTasks.slice(0, 5);
//   const tasksTitle = todayTasks.length > 0 ? "Due Today" : "Upcoming";
//   const hasTasks = tasksToShow.length > 0;

//   const todayRevisions = revisions.filter(r => r.status === 'pending');
//   const overdueRevisions = revisions.filter(r => r.status === 'overdue');

//   const incompleteOverdueRevisions = overdueRevisions.filter(r => !r.isDone);
//   const incompleteTodayRevisions = todayRevisions.filter(r => !r.isDone);
  
//   // Collect all completed revisions (both overdue and today) and put them at the very bottom
//   const completedRevisions = [...overdueRevisions, ...todayRevisions]
//     .filter(r => r.isDone)
//     .sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime());

//   const totalDue = incompleteOverdueRevisions.length + incompleteTodayRevisions.length;

//   const groupedIncompleteTodayRevisions = useMemo(() => {
//     const groups: Record<string, typeof incompleteTodayRevisions> = {};
//     incompleteTodayRevisions.forEach(r => {
//       if (!groups[r.subjectId]) groups[r.subjectId] = [];
//       groups[r.subjectId].push(r);
//     });
//     return groups;
//   }, [incompleteTodayRevisions]);

//   const toggleTask = async (id: string) => {
//     const task = tasks.find(t => t.id === id);
//     if (!task) return;
    
//     setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t));
    
//     try {
//       const { toggleTaskStatus, toggleReminder } = await import('@/app/actions/capture.actions');
//       if (task.type === 'task') {
//         await toggleTaskStatus(id, !task.isDone);
//       } else {
//         await toggleReminder(id, !task.isDone);
//       }
//     } catch (e) {
//       console.error(e);
//       // Revert on failure
//       setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: task.isDone } : t));
//     }
//   };

//   const toggleTaskExpansion = (taskId: string) => {
//     setExpandedTaskIds(prev => {
//       const next = new Set(prev);
//       if (next.has(taskId)) next.delete(taskId);
//       else next.add(taskId);
//       return next;
//     });
//   };

//   return (
//     <div className="p-8 pb-24 max-w-[1100px]  mx-auto w-full min-h-full flex flex-col">
//       <TriageInterceptor 
//         unverifiedBlocks={unverifiedBlocks} 
//         onComplete={() => router.refresh()} 
//       />

//       {/* ── Header ──────────────────────────────────────────────────────────── */}
//       <header className="flex flex-col gap-1 mb-6">
//         <div className="flex justify-between items-start">
//           <div>
//             <h1 className="text-3xl font-bold text-foreground">
//               {getGreeting()}, {MOCK_USER.name}
//             </h1>
//             <p className="text-foreground/50 text-sm mt-1">
//               {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
//             </p>
//           </div>
//           <div className="flex items-center gap-4 mt-1">
//             <div className="flex items-center gap-1.5 text-sm text-foreground/50">
//               <Flame className="w-4 h-4 text-orange-400" />
//               <span className="font-semibold text-orange-400">{stats.streak}</span>
//               <span>day streak</span>
//             </div>
//             <div className="h-4 w-px bg-divider" />
//             <div className="flex items-center gap-1.5 text-sm text-foreground/50">
//               <BookOpen className="w-4 h-4 text-foreground/40" />
//               <span className="font-semibold text-foreground/70">{stats.totalTopics}</span>
//               <span>topics</span>
//             </div>
//             <div className="h-4 w-px bg-divider" />
//             <div className="flex items-center gap-1.5 text-sm text-foreground/50">
//               <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
//               <span className="font-semibold text-emerald-500/70">{stats.totalRevisionsDone}</span>
//               <span>reviews</span>
//             </div>
//             <div className="h-4 w-px bg-divider ml-2" />
//             <button 
//               onClick={() => setIsCreateModalOpen(true)}
//               className="flex items-center gap-1.5 bg-accent hover:bg-[#026EC1] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors ml-2"
//             >
//               <FolderPlus className="w-4 h-4" />
//               New Subject
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* ── Schedule Timeline ────────────────────────────────────────────── */}
//       <section className="mb-8 mt-2">
//         <div className="relative">
//           {/* The bar */}
//           <div className="relative flex h-[6px] rounded-full overflow-hidden bg-divider">
//             {(() => {
//               if (scheduleBlocks.length === 0) return <div className="h-full w-full bg-divider" />;

//               // Compute timeline range from actual blocks
//               const allStartMins = scheduleBlocks.map(b => {
//                 const [h, m] = b.startTime.split(':').map(Number);
//                 return h * 60 + m;
//               });
//               const allEndMins = scheduleBlocks.map(b => {
//                 const [sh, sm] = b.startTime.split(':').map(Number);
//                 const [eh, em] = b.endTime.split(':').map(Number);
//                 let endMin = eh * 60 + em;
//                 if (endMin <= (sh * 60 + sm)) endMin += 24 * 60; // Handle midnight crossover
//                 return endMin;
//               });
//               const timelineStart = Math.min(...allStartMins);
//               const timelineEnd = Math.max(...allEndMins);
//               const totalMinutes = timelineEnd - timelineStart;
//               if (totalMinutes <= 0) return <div className="h-full w-full bg-divider" />;

//               return scheduleBlocks.map((block, i) => {
//                 const [sh, sm] = block.startTime.split(':').map(Number);
//                 const [eh, em] = block.endTime.split(':').map(Number);
//                 const blockStartMin = sh * 60 + sm;
//                 let blockEndMin = eh * 60 + em;
//                 if (blockEndMin <= blockStartMin) blockEndMin += 24 * 60;

//                 const durationMinutes = blockEndMin - blockStartMin;
//                 const widthPct = (durationMinutes / totalMinutes) * 100;

//                 const prevEnd = i > 0 ? allEndMins[i - 1] : timelineStart;
//                 const gapMinutes = blockStartMin - prevEnd;
//                 const gapPct = Math.max(0, (gapMinutes / totalMinutes) * 100);

//                 const now = new Date();
//                 let currentMinutes = now.getHours() * 60 + now.getMinutes();
//                 if (currentMinutes < timelineStart && timelineEnd > 24 * 60) currentMinutes += 24 * 60;
                
//                 const isActive = currentMinutes >= blockStartMin && currentMinutes < blockEndMin;

//                 const isLastBlock = i === scheduleBlocks.length - 1;

//                 return (
//                   <div key={block.id} className="contents">
//                     {gapPct > 0.5 && <div style={{ width: `${gapPct}%` }} />}
//                     <div
//                       className={`h-full transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'} ${!isLastBlock ? 'border-r-2 border-background' : ''}`}
//                       style={{ width: `${widthPct}%`, backgroundColor: block.color }}
//                     />
//                   </div>
//                 );
//               });
//             })()}
//           </div>

//           {/* Current time indicator */}
//           {(() => {
//             if (scheduleBlocks.length === 0) return null;
//             const allStartMins = scheduleBlocks.map(b => {
//               const [h, m] = b.startTime.split(':').map(Number);
//               return h * 60 + m;
//             });
//             const allEndMins = scheduleBlocks.map(b => {
//               const [sh, sm] = b.startTime.split(':').map(Number);
//               const [eh, em] = b.endTime.split(':').map(Number);
//               let endMin = eh * 60 + em;
//               if (endMin <= (sh * 60 + sm)) endMin += 24 * 60;
//               return endMin;
//             });
//             const timelineStart = Math.min(...allStartMins);
//             const timelineEnd = Math.max(...allEndMins);
//             const totalMinutes = timelineEnd - timelineStart;
//             if (totalMinutes <= 0) return null;

//             const now = new Date();
//             let currentMinutes = now.getHours() * 60 + now.getMinutes();
//             if (currentMinutes < timelineStart && timelineEnd > 24 * 60) currentMinutes += 24 * 60;
            
//             const pct = Math.max(0, Math.min(100, ((currentMinutes - timelineStart) / totalMinutes) * 100));
//             return (
//               <div className="absolute top-[-4px] z-10" style={{ left: `${pct}%` }}>
//                 <div className="w-[14px] h-[14px] rounded-full border-2 border-background bg-accent shadow-[0_0_10px_rgba(0,122,204,0.6)] -ml-[7px]" />
//               </div>
//             );
//           })()}

//           {/* Labels below */}
//           <div className="relative flex mt-2.5 min-h-[30px]">
//             {(() => {
//               if (scheduleBlocks.length === 0) return null;
//               const allStartMins = scheduleBlocks.map(b => {
//                 const [h, m] = b.startTime.split(':').map(Number);
//                 return h * 60 + m;
//               });
//               const allEndMins = scheduleBlocks.map(b => {
//                 const [sh, sm] = b.startTime.split(':').map(Number);
//                 const [eh, em] = b.endTime.split(':').map(Number);
//                 let endMin = eh * 60 + em;
//                 if (endMin <= (sh * 60 + sm)) endMin += 24 * 60;
//                 return endMin;
//               });
//               const timelineStart = Math.min(...allStartMins);
//               const timelineEnd = Math.max(...allEndMins);
//               const totalMinutes = timelineEnd - timelineStart;
//               if (totalMinutes <= 0) return null;

//               const lastBlockIndex = allEndMins.indexOf(timelineEnd);
//               const finalEndTime = scheduleBlocks[lastBlockIndex].endTime;
//               const lastBlockDuration = timelineEnd - allStartMins[lastBlockIndex];
//               const showEndLabel = lastBlockDuration > 90; // Hide to prevent overlap if last block is short

//               return (
//                 <>
//                   {scheduleBlocks.map((block, i) => {
//                     const [sh, sm] = block.startTime.split(':').map(Number);
//                     const [eh, em] = block.endTime.split(':').map(Number);
//                     const blockStartMin = sh * 60 + sm;
//                     let blockEndMin = eh * 60 + em;
//                     if (blockEndMin <= blockStartMin) blockEndMin += 24 * 60;
                    
//                     const durationMinutes = blockEndMin - blockStartMin;
//                     const widthPct = (durationMinutes / totalMinutes) * 100;
                    
//                     const prevEnd = i > 0 ? allEndMins[i - 1] : timelineStart;
//                     const gapMinutes = blockStartMin - prevEnd;
//                     const gapPct = Math.max(0, (gapMinutes / totalMinutes) * 100);

//                     const now = new Date();
//                     let currentMinutes = now.getHours() * 60 + now.getMinutes();
//                     if (currentMinutes < timelineStart && timelineEnd > 24 * 60) currentMinutes += 24 * 60;
                    
//                     const isActive = currentMinutes >= blockStartMin && currentMinutes < blockEndMin;
                    
//                     const isActivelyRunning = isActive && (!block.sessionLogs || block.sessionLogs.length === 0);
                    
//                     let nextBlock = null;
//                     if (isActivelyRunning) {
//                       nextBlock = scheduleBlocks.filter(b => {
//                         if (b.id === block.id) return false;
//                         const [bSh, bSm] = b.startTime.split(':').map(Number);
//                         return (bSh * 60 + bSm) >= blockEndMin;
//                       }).sort((a, b) => {
//                         const aStart = parseInt(a.startTime.replace(':', ''));
//                         const bStart = parseInt(b.startTime.replace(':', ''));
//                         return aStart - bStart;
//                       })[0] || null;
//                     }

//                     return (
//                       <div key={block.id} className="contents">
//                         {gapPct > 0.5 && <div style={{ width: `${gapPct}%` }} />}
//                         <div style={{ width: `${widthPct}%` }} className="min-w-0 pr-2 relative group">
//                           <div className="flex items-center gap-1.5">
//                             {isActivelyRunning && (
//                               <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
//                             )}
//                             <p className={`text-[10px] font-medium truncate ${isActive ? 'text-foreground/70' : 'text-foreground/30'}`}>
//                               {block.title}
//                             </p>
//                           </div>
//                           <p className={`text-[9px] font-mono mt-px truncate ${isActive ? 'text-foreground/50' : 'text-foreground/20'}`}>
//                             {format12h(block.startTime)}
//                           </p>

//                           {isActivelyRunning && (
//                             <ActiveBlockActions currentBlock={block} nextBlock={nextBlock} isLast={isLastBlock} />
//                           )}
//                         </div>
//                       </div>
//                     );
//                   })}
//                   {/* End Time Label */}
//                   {showEndLabel && (
//                     <div className="absolute right-0 top-0 text-right w-[60px]">
//                       <p className="text-[10px] font-medium text-transparent select-none">End</p>
//                       <p className="text-[9px] font-mono mt-px text-foreground/40">
//                         {format12h(finalEndTime)}
//                       </p>
//                     </div>
//                   )}
//                 </>
//               );
//             })()}
//           </div>
//         </div>
//       </section>


//       {/* ── Main Content: 2-column layout ───────────────────────────────────── */}
//       <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

//         {/* ── Left Column ──────────────────────────────────────────────────── */}
//         <section>
//           <div className="flex justify-between items-center h-8 mb-4">
//             <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-2">
//               Revisions Due
//               <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/20 normal-case tracking-normal font-bold">
//                 {totalDue}
//               </span>
//             </h2>
//             {totalDue > 0 && (
//               <button className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
//                 <Play className="w-3.5 h-3.5 fill-current" /> Start Revision
//               </button>
//             )}
//           </div>

//           {/* Unified revision list — overdue first, then today */}
//           <div className="flex flex-col gap-2">
//             {/* Overdue items (Incomplete) */}
//             {incompleteOverdueRevisions.map(rev => (
//               <div
//                 key={rev.id}
//                 onClick={() => {
//                   if (!rev.isQuickNote) {
//                     router.push(`/topic/${rev.topicId}`);
//                   } else {
//                     toggleTaskExpansion(rev.id);
//                   }
//                 }}
//                 className={`group bg-sidebar border border-[#f48771]/15 rounded-lg p-4 transition-colors flex items-center justify-between cursor-pointer ${taskActionMenuId === rev.id ? 'relative z-50' : ''} hover:bg-hover`}
//               >
//                 <div className="flex items-center gap-3">
//                   <div className="task-action-menu-container" onClick={(e) => e.stopPropagation()}>
//                     <TaskActionMenu 
//                       task={rev}
//                       isOpen={taskActionMenuId === rev.id}
//                       onToggle={async () => {
//                         const { toggleRevision } = await import('@/app/actions/planner.actions');
//                         await toggleRevision(rev.id, !rev.isDone);
//                       }}
//                       onReschedule={() => { setRescheduleTaskTarget({ id: rev.id, type: 'revision', title: rev.topicTitle }); setTaskActionMenuId(null); }}
//                       onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(rev.id); }}
//                       onClose={() => setTaskActionMenuId(null)}
//                       circleColorClass="text-[#f48771]/40"
//                       hoverColorClass="group-hover/btn:text-[#f48771] group-hover:text-[#f48771]"
//                       sizeClass="w-5 h-5"
//                       labels={{ complete: "Complete", reschedule: "Reschedule" }}
//                     />
//                   </div>
//                   <div>
//                     <div className="flex items-center gap-2">
//                       <span className="font-medium text-foreground">{rev.topicTitle}</span>
//                       {rev.tags[0] && (
//                         <div className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2">
//                           <span className="text-[10px] text-foreground/40 font-medium">
//                             #{rev.tags[0].replace('#', '')}
//                           </span>
//                         </div>
//                       )}
//                     </div>
//                     <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">

//                       {rev.subjectName}
//                       <span className="text-foreground/20 mx-0.5">•</span>
//                       {rev.isQuickNote ? (
//                         <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
//                       ) : (
//                         <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
//                       )}
//                       <span className="text-foreground/20 mx-0.5">•</span>
//                       Cycle {rev.cycleNumber} of 4
//                     </p>
//                     {rev.isQuickNote && rev.description && (
//                       <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'} text-foreground/50`}>
//                         {rev.description}
//                       </p>
//                     )}
//                     {rev.isQuickNote && rev.attachments && rev.attachments.length > 0 && (
//                       <div className="flex flex-wrap gap-2 mt-2">
//                         {rev.attachments.map((att, idx) => {
//                           const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                           return (
//                             <button 
//                               key={idx} 
//                               onClick={(e) => {
//                                 e.stopPropagation();
//                                 setPreviewDocument({
//                                   id: att.url,
//                                   title: att.fileName || rev.topicTitle || 'Attachment',
//                                   url: att.url,
//                                   category: isImg ? 'image' : 'file',
//                                   thumbnailUrl: isImg ? att.url : undefined,
//                                   addedAt: ''
//                                 });
//                               }}
//                               className="block"
//                             >
//                               {isImg ? (
//                                 /* eslint-disable-next-line @next/next/no-img-element */
//                                 <img src={att.url} alt="Attachment" className="w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity" />
//                               ) : (
//                                 <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors">
//                                   <Paperclip className="w-3 h-3 text-foreground/50" />
//                                 </div>
//                               )}
//                             </button>
//                           );
//                         })}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//                 <span className="text-xs font-medium text-[#f48771] flex items-center gap-1 shrink-0">
//                   <Clock className="w-3 h-3" /> Overdue ({getCycleName(rev.intervalDays)})
//                 </span>
//               </div>
//             ))}

//             {/* Today items (Incomplete) */}
//             {Object.entries(groupedIncompleteTodayRevisions).map(([subjectId, revisions]) => (
//               revisions.map(rev => (
//                 <div
//                   key={rev.id}
//                   onClick={() => {
//                     if (!rev.isQuickNote) {
//                       router.push(`/topic/${rev.topicId}`);
//                     } else {
//                       toggleTaskExpansion(rev.id);
//                     }
//                   }}
//                   className={`group bg-sidebar border border-divider rounded-lg p-4 transition-colors flex items-center justify-between cursor-pointer ${taskActionMenuId === rev.id ? 'relative z-50' : ''} ${rev.isDone ? 'opacity-50' : 'hover:bg-hover'}`}
//                 >
//                   <div className="flex items-center gap-3">
//                     <div className="task-action-menu-container" onClick={(e) => e.stopPropagation()}>
//                       <TaskActionMenu 
//                         task={rev}
//                         isOpen={taskActionMenuId === rev.id}
//                         onToggle={async () => {
//                           const { toggleRevision } = await import('@/app/actions/planner.actions');
//                           await toggleRevision(rev.id, true);
//                         }}
//                         onReschedule={() => { setRescheduleTaskTarget({ id: rev.id, type: 'revision', title: rev.topicTitle }); setTaskActionMenuId(null); }}
//                         onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(rev.id); }}
//                         onClose={() => setTaskActionMenuId(null)}
//                         circleColorClass="text-foreground/30"
//                         hoverColorClass="group-hover/btn:text-accent group-hover:text-accent"
//                         sizeClass="w-5 h-5"
//                         labels={{ complete: "Complete", reschedule: "Reschedule" }}
//                       />
//                     </div>
//                     <div>
//                       <div className="flex items-center gap-2">
//                         <span className="font-medium">{rev.topicTitle}</span>
//                         {rev.tags[0] && (
//                           <div className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2">
//                             <span className="text-[10px] text-foreground/40 font-medium">
//                               #{rev.tags[0].replace('#', '')}
//                             </span>
//                           </div>
//                         )}
//                       </div>
//                       <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">

//                         {rev.subjectName}
//                         <span className="text-foreground/20 mx-0.5">•</span>
//                         {rev.isQuickNote ? (
//                           <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
//                         ) : (
//                           <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
//                         )}
//                         <span className="text-foreground/20 mx-0.5">•</span>
//                         Cycle {rev.cycleNumber} of 4
//                       </p>
//                       {rev.isQuickNote && rev.description && (
//                         <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'} text-foreground/50`}>
//                           {rev.description}
//                         </p>
//                       )}
//                       {rev.isQuickNote && rev.attachments && rev.attachments.length > 0 && (
//                         <div className="flex flex-wrap gap-2 mt-2">
//                           {rev.attachments.map((att, idx) => {
//                             const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                             return (
//                               <button 
//                                 key={idx} 
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   setPreviewDocument({
//                                     id: att.url,
//                                     title: att.fileName || rev.topicTitle || 'Attachment',
//                                     url: att.url,
//                                     category: isImg ? 'image' : 'file',
//                                     thumbnailUrl: isImg ? att.url : undefined,
//                                     addedAt: ''
//                                   });
//                                 }}
//                                 className="block"
//                               >
//                                 {isImg ? (
//                                   /* eslint-disable-next-line @next/next/no-img-element */
//                                   <img src={att.url} alt="Attachment" className="w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity" />
//                                 ) : (
//                                   <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors">
//                                     <Paperclip className="w-3 h-3 text-foreground/50" />
//                                   </div>
//                                 )}
//                               </button>
//                             );
//                           })}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                   <span className="text-sm text-foreground/40 font-medium shrink-0">{getCycleName(rev.intervalDays)}</span>
//                 </div>
//               ))
//             ))}

//             {/* Completed Items (Both Overdue & Today) */}
//             {completedRevisions.length > 0 && (
//               <>
//                 {completedRevisions.map(rev => (
//                   <div
//                     key={rev.id}
//                     onClick={() => {
//                       if (!rev.isQuickNote) {
//                         router.push(`/topic/${rev.topicId}`);
//                       } else {
//                         toggleTaskExpansion(rev.id);
//                       }
//                     }}
//                     className={`group bg-sidebar border border-divider rounded-lg p-4 transition-colors flex items-center justify-between cursor-pointer opacity-50 hover:opacity-75 ${taskActionMenuId === rev.id ? 'relative z-50' : ''}`}
//                   >
//                     <div className="flex items-center gap-3">
//                       <div className="task-action-menu-container" onClick={(e) => e.stopPropagation()}>
//                         <TaskActionMenu 
//                           task={rev}
//                           isOpen={taskActionMenuId === rev.id}
//                           onToggle={async () => {
//                             const { toggleRevision } = await import('@/app/actions/planner.actions');
//                             await toggleRevision(rev.id, !rev.isDone);
//                           }}
//                           onReschedule={() => { setRescheduleTaskTarget({ id: rev.id, type: 'revision', title: rev.topicTitle }); setTaskActionMenuId(null); }}
//                           onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(rev.id); }}
//                           onClose={() => setTaskActionMenuId(null)}
//                           circleColorClass="text-emerald-500/70"
//                           hoverColorClass="group-hover/btn:text-emerald-500 group-hover:text-emerald-500/70"
//                           sizeClass="w-5 h-5"
//                           labels={{ complete: "Unmark", reschedule: "Reschedule" }}
//                         />
//                       </div>
//                       <div>
//                         <div className="flex items-center gap-2">
//                           <span className="font-medium text-foreground line-through text-foreground/50">{rev.topicTitle}</span>
//                           {rev.tags[0] && (
//                             <div className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2 opacity-50">
//                               <span className="text-[10px] text-foreground/40 font-medium">
//                                 #{rev.tags[0].replace('#', '')}
//                               </span>
//                             </div>
//                           )}
//                         </div>
//                         <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">
//                           {rev.subjectName}
//                           <span className="text-foreground/20 mx-0.5">•</span>
//                           {rev.isQuickNote ? (
//                             <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
//                           ) : (
//                             <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
//                           )}
//                           <span className="text-foreground/20 mx-0.5">•</span>
//                           Cycle {rev.cycleNumber} of 4
//                         </p>
//                         {rev.isQuickNote && rev.description && (
//                           <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'} text-foreground/20`}>
//                             {rev.description}
//                           </p>
//                         )}
//                         {rev.isQuickNote && rev.attachments && rev.attachments.length > 0 && (
//                           <div className="flex flex-wrap gap-2 mt-2">
//                             {rev.attachments.map((att, idx) => {
//                               const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                               return (
//                                 <button 
//                                   key={idx} 
//                                   onClick={(e) => {
//                                     e.stopPropagation();
//                                     setPreviewDocument({
//                                       id: att.url,
//                                       title: att.fileName || rev.topicTitle || 'Attachment',
//                                       url: att.url,
//                                       category: isImg ? 'image' : 'file',
//                                       thumbnailUrl: isImg ? att.url : undefined,
//                                       addedAt: ''
//                                     });
//                                   }}
//                                   className="block"
//                                 >
//                                   {isImg ? (
//                                     /* eslint-disable-next-line @next/next/no-img-element */
//                                     <img src={att.url} alt="Attachment" className="w-8 h-8 object-cover rounded-sm border border-divider/50 opacity-40 hover:opacity-80 transition-opacity" />
//                                   ) : (
//                                     <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 opacity-40 hover:bg-hover transition-colors">
//                                       <Paperclip className="w-3 h-3 text-foreground/50" />
//                                     </div>
//                                   )}
//                                 </button>
//                               );
//                             })}
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </>
//             )}
//             {totalDue === 0 && (
//               <div className="bg-sidebar border border-divider rounded-lg p-8 flex flex-col items-center justify-center text-center">
//                 <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-2" />
//                 <p className="font-medium text-foreground/80">You&apos;re all caught up!</p>
//                 <p className="text-sm text-foreground/40 mt-1">No revisions due today.</p>
//               </div>
//             )}
//           </div>
//         </section>

//         {/* ── Right Column ─────────────────────────────────────────────────── */}
//         <div className="flex flex-col space-y-8">

//           {/* TASKS */}
//           {hasTasks && (
//             <section>
//             <div className="flex justify-between items-center h-8 mb-4">
//               <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-2">
//                 {tasksTitle}
//                 <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-foreground/5 text-foreground/40 border border-divider normal-case tracking-normal font-bold">
//                   {tasksToShow.length}
//                 </span>
//               </h2>
//               <div className="flex items-center gap-2">
//                 <button 
//                   onClick={() => setIsAllTasksModalOpen(true)}
//                   className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-accent font-medium transition-colors"
//                 >
//                   All <ChevronRight className="w-3.5 h-3.5" />
//                 </button>
//               </div>
//             </div>

//             <div className="flex flex-col gap-2">
//               {tasksToShow.map(task => (
//                 <div
//                   key={task.id}
//                   onClick={() => toggleTaskExpansion(task.id)}
//                   className={`group bg-sidebar border border-divider rounded-lg px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
//                     task.isDone ? 'opacity-50' : 'hover:bg-hover'
//                   }`}
//                 >
//                   <TaskActionMenu 
//                     task={task}
//                     isOpen={taskActionMenuId === task.id}
//                     onToggle={() => toggleTask(task.id)}
//                     onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
//                     onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
//                     onClose={() => setTaskActionMenuId(null)}
//                     circleColorClass="text-foreground/30"
//                     hoverColorClass="group-hover/btn:text-accent group-hover:text-foreground/50"
//                     sizeClass="w-4 h-4"
//                   />
//                     <div className="flex-1 min-w-0">
//                     <p className={`text-[12px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>
//                       {task.title}
//                     </p>
//                     {task.description && (
//                       <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(task.id) ? '' : 'line-clamp-2'} ${task.isDone ? 'text-foreground/20' : 'text-foreground/50'}`}>
//                         {task.description}
//                       </p>
//                     )}
//                     {task.attachments && task.attachments.length > 0 && (
//                       <div className="flex flex-wrap gap-2 mt-2">
//                         {task.attachments.map((att, idx) => {
//                           const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                           return (
//                             <button 
//                               key={idx} 
//                               onClick={(e) => {
//                                 e.stopPropagation();
//                                 setPreviewDocument({
//                                   id: att.url,
//                                   title: att.fileName || task.title || 'Attachment',
//                                   url: att.url,
//                                   category: isImg ? 'image' : 'file',
//                                   thumbnailUrl: isImg ? att.url : undefined,
//                                   addedAt: ''
//                                 });
//                               }}
//                               className="block"
//                             >
//                               {isImg ? (
//                                 /* eslint-disable-next-line @next/next/no-img-element */
//                                 <img src={att.url} alt="Attachment" className={`w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity ${task.isDone ? 'opacity-40' : ''}`} />
//                               ) : (
//                                 <div className={`flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors ${task.isDone ? 'opacity-40' : ''}`}>
//                                   <Paperclip className="w-3 h-3 text-foreground/50" />
//                                 </div>
//                               )}
//                             </button>
//                           );
//                         })}
//                       </div>
//                     )}
//                     <div className="flex items-center gap-2 mt-1.5 flex-wrap">
//                       {task.isOverdue && (
//                         <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-red-500/10 text-red-400 border border-red-500/20 font-bold uppercase tracking-wider">
//                           Overdue
//                         </span>
//                       )}
//                       {task.type === 'reminder' && !task.isOverdue && (
//                         <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
//                           REMINDER
//                         </span>
//                       )}
//                       {(task.dueDate || task.time) && (
//                         <span className="text-[10px] text-foreground/40 font-mono">
//                           {(() => {
//                             const dateToFormat = task.dueDate || task.time;
//                             if (!dateToFormat) return null;
//                             if (typeof dateToFormat === 'string' && dateToFormat.includes('T')) {
//                               const d = new Date(dateToFormat);
//                               if (!isNaN(d.getTime())) {
//                                 return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
//                               }
//                             } else if (dateToFormat instanceof Date) {
//                               return dateToFormat.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
//                             }
//                             return task.time;
//                           })()}
//                         </span>
//                       )}
//                       {task.source && (
//                         <ExternalLink className="w-3 h-3 text-foreground/20 group-hover:text-accent/50 transition-colors" />
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </section>
//           )}

//           {/* INBOX */}
//           {filteredInbox.length > 0 && (
//             <section>
//             <div className="flex justify-between items-center h-8 mb-4">
//               <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
//                 Inbox
//               </h2>
//               <button className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-accent font-medium transition-colors">
//                 All <ChevronRight className="w-3.5 h-3.5" />
//               </button>
//             </div>
//             <div className="flex flex-col gap-2">
//               {filteredInbox.slice(0, 5).map(item => (
//                 <div
//                   key={item.id}
//                   className="group bg-sidebar border border-divider rounded-lg px-4 py-3 hover:bg-hover transition-colors cursor-pointer"
//                 >
//                   <div className="flex items-start gap-2.5">
//                     <div className="mt-0.5 shrink-0">
//                       {item.type === 'link' && <Link2 className="w-4 h-4 text-accent/50" />}
//                       {item.type === 'file' && <FileText className="w-4 h-4 text-amber-400/50" />}
//                       {item.type === 'note' && <FileText className="w-4 h-4 text-emerald-400/50" />}
//                     </div>
//                     <div className="flex-1 min-w-0">
//                       <p className="text-[13px] font-medium leading-snug text-foreground/90">{item.title}</p>
//                       {item.attachments && item.attachments.length > 0 && (
//                         <div className="flex flex-wrap gap-2 mt-2">
//                           {item.attachments.map((att, idx) => {
//                             const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                             return (
//                               <button 
//                                 key={idx} 
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   setPreviewDocument({
//                                     id: att.url,
//                                     title: att.fileName || item.title || 'Attachment',
//                                     url: att.url,
//                                     category: isImg ? 'image' : 'file',
//                                     thumbnailUrl: isImg ? att.url : undefined,
//                                     addedAt: ''
//                                   });
//                                 }}
//                                 className="block"
//                               >
//                                 {isImg ? (
//                                   /* eslint-disable-next-line @next/next/no-img-element */
//                                   <img src={att.url} alt="Attachment" className="w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity" />
//                                 ) : (
//                                   <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors">
//                                     <Paperclip className="w-3 h-3 text-foreground/50" />
//                                   </div>
//                                 )}
//                               </button>
//                             );
//                           })}
//                         </div>
//                       )}
//                       <div className="flex flex-wrap gap-1 mt-1.5">
//                         {item.tags?.map(tag => (
//                           <span key={tag} className="text-[10px] text-foreground/40 font-medium mr-1.5">
//                             {tag.replace('#', '')}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </section>
//           )}

//           {/* PROGRESS */}
//           <section>
//             <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider h-8 flex items-center mb-4">
//               Progress
//             </h2>
//             <div className="bg-sidebar border border-divider rounded-lg p-4 space-y-4">
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2 text-sm text-foreground/60">
//                   <Target className="w-4 h-4 text-accent/50" />
//                   <span>Mastered</span>
//                 </div>
//                 <span className="text-sm font-semibold text-foreground/70">{stats.mastered} / {stats.totalTopics}</span>
//               </div>
//               <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
//                 <div 
//                   className="h-full bg-accent rounded-full transition-all duration-500" 
//                   style={{ width: `${stats.totalTopics > 0 ? (stats.mastered / stats.totalTopics) * 100 : 0}%` }} 
//                 />
//               </div>
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2 text-sm text-foreground/60">
//                   <Zap className="w-4 h-4 text-amber-400/50" />
//                   <span>In progress</span>
//                 </div>
//                 <span className="text-sm font-semibold text-foreground/70">{stats.inProgress}</span>
//               </div>
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2 text-sm text-foreground/60">
//                   <Inbox className="w-4 h-4 text-accent/50" />
//                   <span>Inbox ({filteredInbox.length})</span>
//                 </div>
//                 <span className="text-sm font-semibold text-foreground/70"></span>
//               </div>
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2 text-sm text-foreground/60">
//                   <BookOpen className="w-4 h-4 text-foreground/30" />
//                   <span>Not started</span>
//                 </div>
//                 <span className="text-sm font-semibold text-foreground/70">{stats.notStarted}</span>
//               </div>
//             </div>
//           </section>
//         </div>
//       </div>

//       {/* Bottom Spacer */}
//       <div className="h-24 w-full flex-shrink-0" />


      
//       <CreateSubjectModal 
//         isOpen={isCreateModalOpen} 
//         onClose={() => setIsCreateModalOpen(false)} 
//       />

//       {/* View All Tasks Modal */}
//       {isAllTasksModalOpen && (
//         <div
//           className="fixed inset-0 z-[100] flex items-center justify-center"
//           style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
//           onClick={(e) => { if (e.target === e.currentTarget) setIsAllTasksModalOpen(false); }}
//         >
//           <div className="bg-[#191919] border border-divider/60 rounded-2xl w-full max-w-[720px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">

//             {/* Header */}
//             <div className="flex justify-between items-start px-6 pt-6 pb-4">
//               <div>
//                 <p className="text-[11px] font-semibold text-foreground/30 uppercase tracking-widest mb-1">Task Manager</p>
//                 <h2 className="text-[22px] font-bold text-foreground leading-tight">All Tasks</h2>
//               </div>
//               <div className="flex items-center gap-3 mt-1">
//                 <div className="flex items-center gap-4 text-[11px] font-semibold text-foreground/40">
//                   {overdueTasks.length > 0 && (
//                     <span className="text-red-400">{overdueTasks.length} overdue</span>
//                   )}
//                   <span className="text-foreground/30">{undoneTasks.length} total</span>
//                 </div>
//                 <button
//                   onClick={() => setIsAllTasksModalOpen(false)}
//                   className="p-1.5 text-foreground/30 hover:text-foreground hover:bg-hover rounded-lg transition-all"
//                 >
//                   <X className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>

//             {/* Tab Strip */}
//             <div className="px-6 pb-0">
//               <div className="flex items-center gap-1 p-1 bg-background rounded-xl">
//                 {([
//                   { key: 'overdue', label: 'Overdue', count: overdueTasks.length, activeColor: 'bg-red-500/15 text-red-400', dotColor: 'bg-red-400' },
//                   { key: 'today',   label: 'Today',   count: todayTasks.length,   activeColor: 'bg-accent/15 text-accent',   dotColor: 'bg-accent' },
//                   { key: 'upcoming',label: 'Upcoming',count: upcomingTasks.length, activeColor: 'bg-foreground/10 text-foreground', dotColor: 'bg-foreground/40' },
//                 ] as const).map(tab => (
//                   <button
//                     key={tab.key}
//                     onClick={() => setActiveTaskTab(tab.key)}
//                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12px] font-semibold transition-all ${
//                       activeTaskTab === tab.key
//                         ? tab.activeColor + ' shadow-sm'
//                         : 'text-foreground/40 hover:text-foreground/70 hover:bg-hover/50'
//                     }`}
//                   >
//                     {activeTaskTab === tab.key && <div className={`w-1.5 h-1.5 rounded-full ${tab.dotColor}`} />}
//                     {tab.label}
//                     <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
//                       activeTaskTab === tab.key ? 'bg-current/10 opacity-80' : 'bg-foreground/8 text-foreground/30'
//                     }`}>
//                       {tab.count}
//                     </span>
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {/* Task List */}
//             <div className="flex-1 overflow-y-auto p-6 pt-2">
//               <div className="flex flex-col gap-2 pb-32">

//               {/* Overdue Tab */}
//               {activeTaskTab === 'overdue' && (
//                 overdueTasks.length > 0 ? overdueTasks.map(task => (
//                   <div
//                     key={task.id}
//                     onClick={() => toggleTaskExpansion(task.id)}
//                     className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${
//                       task.isDone ? 'opacity-50' : 'hover:bg-hover/40 hover:border-red-500/10'
//                     }`}
//                   >
//                     {!task.isDone && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />}
//                     <TaskActionMenu 
//                       task={task}
//                       isOpen={taskActionMenuId === task.id}
//                       onToggle={() => toggleTask(task.id)}
//                       onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
//                       onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
//                       onClose={() => setTaskActionMenuId(null)}
//                       circleColorClass="text-red-500/40"
//                       hoverColorClass="group-hover/btn:text-red-400 group-hover:text-red-400"
//                       sizeClass="w-[15px] h-[15px]"
//                     />
//                     <div className="flex-1 min-w-0">
//                       <p className={`text-[13px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>{task.title}</p>
//                       <div className="flex flex-wrap items-center gap-2 mt-1">
//                         <p className="text-[11px] text-red-400/70">Overdue</p>
//                         {task.tags?.map(tag => (
//                           <span key={tag} className="text-[10px] text-foreground/40 font-medium ml-1">
//                             {tag.replace('#', '')}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 )) : (
//                   <div className="flex flex-col items-center justify-center h-full text-center pb-4">
//                     <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
//                       <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
//                     </div>
//                     <p className="text-[15px] font-semibold text-foreground/70">All caught up!</p>
//                     <p className="text-[12px] text-foreground/35 mt-1">No overdue tasks. Great work.</p>
//                   </div>
//                 )
//               )}

//               {/* Today Tab */}
//               {activeTaskTab === 'today' && (
//                 todayTasks.length > 0 ? todayTasks.map(task => (
//                   <div
//                     key={task.id}
//                     onClick={() => toggleTaskExpansion(task.id)}
//                     className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${
//                       task.isDone ? 'opacity-50' : 'hover:bg-hover/40 hover:border-accent/10'
//                     }`}
//                   >
//                     {!task.isDone && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full bg-accent/30 group-hover:bg-accent transition-colors" />}
//                     <TaskActionMenu 
//                       task={task}
//                       isOpen={taskActionMenuId === task.id}
//                       onToggle={() => toggleTask(task.id)}
//                       onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
//                       onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
//                       onClose={() => setTaskActionMenuId(null)}
//                       circleColorClass="text-foreground/20"
//                       hoverColorClass="group-hover/btn:text-accent group-hover:text-accent"
//                       sizeClass="w-[15px] h-[15px]"
//                     />
//                     <div className="flex-1 min-w-0">
//                       <p className={`text-[13px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>{task.title}</p>
//                       {task.description && (
//                         <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(task.id) ? '' : 'line-clamp-2'} ${task.isDone ? 'text-foreground/20' : 'text-foreground/50'}`}>
//                           {task.description}
//                         </p>
//                       )}
//                       {task.attachments && task.attachments.length > 0 && (
//                         <div className="flex flex-wrap gap-2 mt-2">
//                           {task.attachments.map((att, idx) => {
//                             const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                             return (
//                               <button 
//                                 key={idx} 
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   setPreviewDocument({
//                                     id: att.url,
//                                     title: att.fileName || task.title || 'Attachment',
//                                     url: att.url,
//                                     category: isImg ? 'image' : 'file',
//                                     thumbnailUrl: isImg ? att.url : undefined,
//                                     addedAt: ''
//                                   });
//                                 }}
//                                 className="block"
//                               >
//                                 {isImg ? (
//                                   /* eslint-disable-next-line @next/next/no-img-element */
//                                   <img src={att.url} alt="Attachment" className={`w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity ${task.isDone ? 'opacity-40' : ''}`} />
//                                 ) : (
//                                   <div className={`flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors ${task.isDone ? 'opacity-40' : ''}`}>
//                                     <Paperclip className="w-3 h-3 text-foreground/50" />
//                                   </div>
//                                 )}
//                               </button>
//                             );
//                           })}
//                         </div>
//                       )}
//                       <div className="flex flex-wrap items-center gap-2 mt-1">
//                         {task.time && <p className="text-[11px] text-foreground/35 font-mono">{task.time}</p>}
//                         {task.tags?.map(tag => (
//                           <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-foreground/5 text-foreground/30 border border-divider uppercase">
//                             {tag.replace('#', '')}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 )) : (
//                   <div className="flex flex-col items-center justify-center h-full text-center pb-4">
//                     <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
//                       <CheckCircle2 className="w-6 h-6 text-accent/50" />
//                     </div>
//                     <p className="text-[15px] font-semibold text-foreground/70">Nothing due today</p>
//                     <p className="text-[12px] text-foreground/35 mt-1">Take a breath or plan ahead.</p>
//                   </div>
//                 )
//               )}

//               {/* Upcoming Tab */}
//               {activeTaskTab === 'upcoming' && (
//                 upcomingTasks.length > 0 ? upcomingTasks.map(task => (
//                   <div
//                     key={task.id}
//                     onClick={() => toggleTaskExpansion(task.id)}
//                     className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${
//                       task.isDone ? 'opacity-50' : 'hover:bg-hover/40 hover:border-divider'
//                     }`}
//                   >
//                     {!task.isDone && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full bg-foreground/10 group-hover:bg-foreground/30 transition-colors" />}
//                     <TaskActionMenu 
//                       task={task}
//                       isOpen={taskActionMenuId === task.id}
//                       onToggle={() => toggleTask(task.id)}
//                       onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
//                       onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
//                       onClose={() => setTaskActionMenuId(null)}
//                       circleColorClass="text-foreground/20"
//                       hoverColorClass="group-hover/btn:text-foreground/50 group-hover:text-foreground/50"
//                       sizeClass="w-[15px] h-[15px]"
//                     />
//                     <div className="flex-1 min-w-0">
//                       <p className={`text-[13px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>{task.title}</p>
//                       {task.description && (
//                         <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(task.id) ? '' : 'line-clamp-2'} ${task.isDone ? 'text-foreground/20' : 'text-foreground/50'}`}>
//                           {task.description}
//                         </p>
//                       )}
//                       {task.attachments && task.attachments.length > 0 && (
//                         <div className="flex flex-wrap gap-2 mt-2">
//                           {task.attachments.map((att, idx) => {
//                             const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
//                             return (
//                               <button 
//                                 key={idx} 
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   setPreviewDocument({
//                                     id: att.url,
//                                     title: att.fileName || task.title || 'Attachment',
//                                     url: att.url,
//                                     category: isImg ? 'image' : 'file',
//                                     thumbnailUrl: isImg ? att.url : undefined,
//                                     addedAt: ''
//                                   });
//                                 }}
//                                 className="block"
//                               >
//                                 {isImg ? (
//                                   /* eslint-disable-next-line @next/next/no-img-element */
//                                   <img src={att.url} alt="Attachment" className={`w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity ${task.isDone ? 'opacity-40' : ''}`} />
//                                 ) : (
//                                   <div className={`flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors ${task.isDone ? 'opacity-40' : ''}`}>
//                                     <Paperclip className="w-3 h-3 text-foreground/50" />
//                                   </div>
//                                 )}
//                               </button>
//                             );
//                           })}
//                         </div>
//                       )}
//                       <div className="flex flex-wrap items-center gap-2 mt-1">
//                         {task.dueDate && (
//                           <p className="text-[11px] text-foreground/35">
//                             {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
//                           </p>
//                         )}
//                         {task.tags?.map(tag => (
//                           <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-foreground/5 text-foreground/30 border border-divider uppercase">
//                             {tag.replace('#', '')}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 )) : (
//                   <div className="flex flex-col items-center justify-center h-full text-center pb-4">
//                     <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4">
//                       <Calendar className="w-6 h-6 text-foreground/25" />
//                     </div>
//                     <p className="text-[15px] font-semibold text-foreground/70">Schedule is clear</p>
//                     <p className="text-[12px] text-foreground/35 mt-1">No tasks planned ahead.</p>
//                   </div>
//                 )
//               )}
//             </div>
//           </div>


//           </div>
//         </div>
//       )}

//       {rescheduleTaskTarget && (
//         <RescheduleModal
//           isOpen={true}
//           onClose={() => setRescheduleTaskTarget(null)}
//           target={{ 
//             id: rescheduleTaskTarget.id, 
//             type: rescheduleTaskTarget.type || 'task', 
//             title: rescheduleTaskTarget.title 
//           }}
//           tasks={tasks}
//           revisions={revisions}
//           blocks={scheduleBlocks}
//           initialRoutineMode={initialRoutineMode}
//           onRescheduleComplete={() => {
//             // Revalidation handles data refetch
//           }}
//         />
//       )}

//       {/* Document Viewer Modal */}
//       {previewDocument && (
//         <ResourcePreviewModal
//           resource={previewDocument}
//           onClose={() => setPreviewDocument(null)}
//         />
//       )}
//     </div>
//   );
// }
