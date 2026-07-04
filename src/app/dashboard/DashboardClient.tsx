'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, BookOpen, CheckCircle2, FolderPlus } from 'lucide-react';
import { CreateSubjectModal } from '@/components/subject/CreateSubjectModal';
import RescheduleModal from '@/components/dashboard/RescheduleModal';
import { ResourcePreviewModal } from '@/app/topic/[id]/components/resources/ResourcePreviewModal';
import { TriageInterceptor } from '@/components/dashboard/TriageInterceptor';
import { DayManagerModal } from '@/components/dashboard/DayManagerModal';
import ScheduleTimeline from './dashComponents/ScheduleTimeline';
import RevisionsList from './dashComponents/RevisionsList';
import TasksSidebar from './dashComponents/TasksSidebar';

// ────────────────────────────────────────────────────────────────────────────────
// TYPES & PROPS (shared — imported as `type` by the dashcomponents files)
// ────────────────────────────────────────────────────────────────────────────────

export interface RevisionProp {
  id: string;
  topicId: string;
  topicTitle: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  cycleNumber: number;
  intervalDays: number;
  scheduledFor: Date;
  status: 'pending' | 'overdue';
  tags: string[];
  isQuickNote: boolean;
  isDone: boolean;
  description?: string | null;
  attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
}

export interface TaskProp {
  id: string;
  title: string;
  isDone: boolean;
  time?: string | null;
  dueDate?: Date | null;
  type: 'reminder' | 'task';
  isOverdue?: boolean;
  source?: string;
  description?: string | null;
  tags?: string[];
  attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
}

export interface InboxProp {
  id: string;
  type: 'link' | 'note' | 'file';
  title: string;
  url?: string;
  createdAt: Date;
  isPinned?: boolean;
  tags: string[];
  attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
}

export interface StatsProp {
  streak: number;
  totalTopics: number;
  totalRevisionsDone: number;
  weeklyActivity: number[];
  mastered: number;
  inProgress: number;
  notStarted: number;
}

export interface ScheduleSlotProp {
  id: string;
  sourceBlockId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED' | 'PARTIAL';
  actualStartTime: string | null;
  actualEndTime: string | null;
  remark: string | null;
  minutesDone: number | null;
  sortOrder: number;
}

export interface PreviewDocument {
  id: string;
  title: string;
  url: string;
  category: 'file' | 'image' | 'link';
  thumbnailUrl?: string;
  addedAt: string;
}

interface DashboardClientProps {
  revisions: RevisionProp[];
  tasks: TaskProp[];
  inbox: InboxProp[];
  stats: StatsProp;
  todaySlots: ScheduleSlotProp[];
  initialRoutineMode: 'MASTER' | 'DAILY';
  unverifiedBlocks?: any[];
}

const MOCK_USER = { name: 'Ramin' };

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

export default function DashboardClient({
  revisions = [],
  tasks: initialTasks = [],
  inbox: rawInbox = [],
  stats,
  todaySlots = [],
  initialRoutineMode,
  unverifiedBlocks = []
}: DashboardClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDayManagerOpen, setIsDayManagerOpen] = useState(false);
  const [taskActionMenuId, setTaskActionMenuId] = useState<string | null>(null);
  const [rescheduleTaskTarget, setRescheduleTaskTarget] = useState<any | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  // Deduplicate items based on priority: Revisions > Tasks > Inbox
  const activeRevisionCaptureIds = useMemo(() => new Set(revisions.map((r: any) => r.capture?.id).filter(Boolean)), [revisions]);
  const filteredTasks = useMemo(() => tasks.filter((t: any) => !activeRevisionCaptureIds.has(t.captureId || t.id)), [tasks, activeRevisionCaptureIds]);
  const activeTaskCaptureIds = useMemo(() => new Set(filteredTasks.map((t: any) => t.captureId || t.id).filter(Boolean)), [filteredTasks]);
  const filteredInbox = useMemo(() => rawInbox.filter((note: any) => !activeRevisionCaptureIds.has(note.id) && !activeTaskCaptureIds.has(note.id)), [rawInbox, activeRevisionCaptureIds, activeTaskCaptureIds]);

  // Group tasks
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const undoneTasks = filteredTasks.filter(t => !t.isDone);
  const overdueTasks = filteredTasks.filter(t => t.isOverdue).sort((a, b) => Number(a.isDone) - Number(b.isDone));
  const todayTasks = filteredTasks.filter(t => {
    if (!t.dueDate) return true; // No due date -> show in today/inbox conceptually
    const d = new Date(t.dueDate);
    return d >= startOfToday && d <= endOfToday;
  }).sort((a, b) => Number(a.isDone) - Number(b.isDone));
  const upcomingTasks = filteredTasks.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d > endOfToday;
  }).sort((a, b) => Number(a.isDone) - Number(b.isDone));

  const tasksToShow = todayTasks.length > 0 ? todayTasks : upcomingTasks.slice(0, 5);
  const tasksTitle = todayTasks.length > 0 ? "Due Today" : "Upcoming";
  const hasTasks = tasksToShow.length > 0;

  const todayRevisions = revisions.filter(r => r.status === 'pending');
  const overdueRevisions = revisions.filter(r => r.status === 'overdue');

  const incompleteOverdueRevisions = overdueRevisions.filter(r => !r.isDone);
  const incompleteTodayRevisions = todayRevisions.filter(r => !r.isDone);

  // Collect all completed revisions (both overdue and today) and put them at the very bottom
  const completedRevisions = [...overdueRevisions, ...todayRevisions]
    .filter(r => r.isDone)
    .sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime());

  const totalDue = incompleteOverdueRevisions.length + incompleteTodayRevisions.length;

  const groupedIncompleteTodayRevisions = useMemo(() => {
    const groups: Record<string, typeof incompleteTodayRevisions> = {};
    incompleteTodayRevisions.forEach(r => {
      if (!groups[r.subjectId]) groups[r.subjectId] = [];
      groups[r.subjectId].push(r);
    });
    return groups;
  }, [incompleteTodayRevisions]);

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t));

    try {
      const { toggleTaskStatus, toggleReminder } = await import('@/app/actions/capture.actions');
      if (task.type === 'task') {
        await toggleTaskStatus(id, !task.isDone);
      } else {
        await toggleReminder(id, !task.isDone);
      }
    } catch (e) {
      console.error(e);
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: task.isDone } : t));
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return (
    <div className="p-8 pb-24 max-w-[1100px]  mx-auto w-full min-h-full flex flex-col">
      <TriageInterceptor
        unverifiedBlocks={unverifiedBlocks}
        onComplete={() => router.refresh()}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {getGreeting()}, {MOCK_USER.name}
            </h1>
            <p className="text-foreground/50 text-sm mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-foreground/50">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-orange-400">{stats.streak}</span>
              <span>day streak</span>
            </div>
            <div className="h-4 w-px bg-divider" />
            <div className="flex items-center gap-1.5 text-sm text-foreground/50">
              <BookOpen className="w-4 h-4 text-foreground/40" />
              <span className="font-semibold text-foreground/70">{stats.totalTopics}</span>
              <span>topics</span>
            </div>
            <div className="h-4 w-px bg-divider" />
            <div className="flex items-center gap-1.5 text-sm text-foreground/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
              <span className="font-semibold text-emerald-500/70">{stats.totalRevisionsDone}</span>
              <span>reviews</span>
            </div>
            <div className="h-4 w-px bg-divider ml-2" />
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 bg-accent hover:bg-[#026EC1] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors ml-2"
            >
              <FolderPlus className="w-4 h-4" />
              New Subject
            </button>
          </div>
        </div>
      </header>

      {/* ── Schedule Timeline (isolated — will grow) ────────────────────────── */}
      <ScheduleTimeline 
        todaySlots={todaySlots} 
        onManageDay={() => setIsDayManagerOpen(true)}
      />

      {/* ── Main Content: 2-column layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

        {/* ── Left Column: Revisions ───────────────────────────────────────── */}
        <RevisionsList
          incompleteOverdueRevisions={incompleteOverdueRevisions}
          groupedIncompleteTodayRevisions={groupedIncompleteTodayRevisions}
          completedRevisions={completedRevisions}
          totalDue={totalDue}
          taskActionMenuId={taskActionMenuId}
          setTaskActionMenuId={setTaskActionMenuId}
          expandedTaskIds={expandedTaskIds}
          toggleTaskExpansion={toggleTaskExpansion}
          setPreviewDocument={setPreviewDocument}
          setRescheduleTaskTarget={setRescheduleTaskTarget}
        />

        {/* ── Right Column: Tasks / Inbox / Progress ──────────────────────────── */}
        <TasksSidebar
          tasksToShow={tasksToShow}
          tasksTitle={tasksTitle}
          hasTasks={hasTasks}
          overdueTasks={overdueTasks}
          todayTasks={todayTasks}
          upcomingTasks={upcomingTasks}
          undoneTasks={undoneTasks}
          filteredInbox={filteredInbox}
          stats={stats}
          taskActionMenuId={taskActionMenuId}
          setTaskActionMenuId={setTaskActionMenuId}
          expandedTaskIds={expandedTaskIds}
          toggleTaskExpansion={toggleTaskExpansion}
          setPreviewDocument={setPreviewDocument}
          setRescheduleTaskTarget={setRescheduleTaskTarget}
          toggleTask={toggleTask}
        />
      </div>

      {/* Bottom Spacer */}
      <div className="h-24 w-full flex-shrink-0" />

      <CreateSubjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <DayManagerModal
        isOpen={isDayManagerOpen}
        onClose={() => setIsDayManagerOpen(false)}
        initialSlots={todaySlots}
      />

      {rescheduleTaskTarget && (
        <RescheduleModal
          isOpen={true}
          onClose={() => setRescheduleTaskTarget(null)}
          target={{
            id: rescheduleTaskTarget.id,
            type: rescheduleTaskTarget.type || 'task',
            title: rescheduleTaskTarget.title
          }}
          tasks={tasks}
          revisions={revisions}
          blocks={todaySlots} // Note: RescheduleModal may need an update to handle slots vs blocks
          initialRoutineMode={initialRoutineMode}
          onRescheduleComplete={() => {
            // Revalidation handles data refetch
          }}
        />
      )}

      {/* Document Viewer Modal */}
      {previewDocument && (
        <ResourcePreviewModal
          resource={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}