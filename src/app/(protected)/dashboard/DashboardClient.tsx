'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, BookOpen, FolderPlus, Menu, Target, Zap, Inbox, Sparkles } from 'lucide-react';
import { CreateSubjectModal } from '@/components/subject/CreateSubjectModal';
import RescheduleModal from '@/components/dashboard/RescheduleModal';
import { ResourcePreviewModal } from '@/app/(protected)/topic/[id]/components/resources/ResourcePreviewModal';
import { TriageInterceptor } from '@/components/dashboard/TriageInterceptor';
import { DayManagerModal } from '@/components/dashboard/DayManagerModal';
import { AiContextExportModal } from '@/components/dashboard/AiContextExportModal';
import ScheduleTimeline from './dashComponents/ScheduleTimeline';
import RevisionsList from './dashComponents/RevisionsList';
import TasksSidebar from './dashComponents/TasksSidebar';
import { WeeklyReviewModal } from '@/components/dashboard/WeeklyReviewModal';
import { DayDebriefModal } from '@/components/dashboard/DayDebriefModal';
import { QuickNotesWidget, QuickNoteType } from '@/components/dashboard/QuickNotesWidget';
import { useAppStore } from '@/store/useAppStore';

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
  goalType?: 'NONE' | 'WEEKLY' | 'MONTHLY';
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
  description?: string | null;
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
  /** % of scheduled blocks actually completed over the last 7 full days. */
  adherence: number | null;
  /** Point change vs the 7 days before that. Positive = improving. */
  adherenceDelta: number | null;
  adherenceDone: number;
  adherenceTotal: number;
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
  quickNotes: QuickNoteType[];
  stats: StatsProp;
  todaySlots: ScheduleSlotProp[];
  initialRoutineMode: 'MASTER' | 'DAILY';
  unverifiedBlocks?: any[];
  habits?: any[];
  workspaceId: string;
  userName?: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  // Past midnight but not yet morning: you're still up from yesterday, so
  // "Good morning" reads as a small daily lie.
  if (h < 5) return 'Still up';
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
  quickNotes = [],
  stats,
  todaySlots = [],
  initialRoutineMode,
  unverifiedBlocks = [],
  habits = [],
  workspaceId,
  userName = 'User',
}: DashboardClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDayManagerOpen, setIsDayManagerOpen] = useState(false);
  const [isDayDebriefOpen, setIsDayDebriefOpen] = useState(false);
  const [isAiExportOpen, setIsAiExportOpen] = useState(false);
  const { setIsMobileMenuOpen } = useAppStore();
  const [taskActionMenuId, setTaskActionMenuId] = useState<string | null>(null);
  const [rescheduleTaskTarget, setRescheduleTaskTarget] = useState<any | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  // Keep local tasks state in sync with server props (for when Server Actions revalidate the page)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

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
  const overdueTasks = filteredTasks.filter(t => t.isOverdue && t.goalType !== 'WEEKLY' && t.goalType !== 'MONTHLY').sort((a, b) => Number(a.isDone) - Number(b.isDone));
  
  // Weekly and Monthly Goals
  const weeklyGoals = filteredTasks.filter(t => t.goalType === 'WEEKLY');
  const monthlyGoals = filteredTasks.filter(t => t.goalType === 'MONTHLY');
  
  // Standard Tasks (NONE)
  const standardTasks = filteredTasks.filter(t => t.goalType === 'NONE' || !t.goalType);

  const todayTasks = standardTasks.filter(t => {
    if (!t.dueDate) return true; // No due date -> show in today/inbox conceptually
    const d = new Date(t.dueDate);
    return d >= startOfToday && d <= endOfToday;
  }).sort((a, b) => Number(a.isDone) - Number(b.isDone));
  
  const upcomingTasks = standardTasks.filter(t => {
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

  // Colour the adherence figure by where it actually sits, not by sentiment.
  const adherenceTone =
    stats.adherence === null ? 'text-muted'
      : stats.adherence >= 70 ? 'text-emerald-500'
      : stats.adherence >= 40 ? 'text-amber-500'
      : 'text-red-400';

  return (
    <div className="p-4 md:p-8 pb-24 max-w-[1200px] mx-auto w-full min-h-full flex flex-col">
      <TriageInterceptor
        unverifiedBlocks={unverifiedBlocks}
        workspaceId={workspaceId}
        onComplete={() => router.refresh()}
      />

      <AiContextExportModal
        isOpen={isAiExportOpen}
        onClose={() => setIsAiExportOpen(false)}
        workspaceId={workspaceId}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 md:gap-1 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-muted hover:text-foreground transition-colors rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {getGreeting()}, {userName}
              </h1>
              <p className="text-muted text-sm mt-0.5 md:mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 md:mt-1">
            <button 
              onClick={() => setIsDayDebriefOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent/20 transition-colors rounded-lg flex items-center gap-1.5 border border-accent/20"
            >
              Wrap Up Day
            </button>
            <button
              onClick={() => setIsAiExportOpen(true)}
              className="p-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors rounded-lg border border-purple-500/20"
              title="Export AI Context"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm text-muted ml-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-orange-400">{stats.streak}</span>
              <span>day streak</span>
            </div>
            {stats.adherence !== null && (
              <>
                <div className="h-4 w-px bg-divider" />
                {/* The honest number. Streak and review counts only ever go up;
                    this one can go down, which is the point. */}
                <div
                  className="flex items-center gap-1.5 text-sm text-muted"
                  title={`${stats.adherenceDone} of ${stats.adherenceTotal} scheduled blocks completed in the last 7 days`}
                >
                  <Target className={`w-4 h-4 ${adherenceTone}`} />
                  <span className={`font-semibold ${adherenceTone}`}>{stats.adherence}%</span>
                  <span>blocks this week</span>
                  {stats.adherenceDelta !== null && stats.adherenceDelta !== 0 && (
                    <span
                      className={`text-xs font-medium ${stats.adherenceDelta > 0 ? 'text-emerald-500' : 'text-red-400'}`}
                      title={`${stats.adherenceDelta > 0 ? 'Up' : 'Down'} ${Math.abs(stats.adherenceDelta)} points vs the previous 7 days`}
                    >
                      {stats.adherenceDelta > 0 ? '↑' : '↓'}{Math.abs(stats.adherenceDelta)}
                    </span>
                  )}
                </div>
              </>
            )}
            <div className="h-4 w-px bg-divider hidden md:block ml-2" />
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 bg-accent hover:bg-[#026EC1] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors md:ml-2 w-full md:w-auto justify-center"
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-8 items-start">

        {/* ── Left Column: Revisions → Tasks / Inbox / Progress ──────────────── */}
        <div className="flex flex-col gap-16 min-w-0">
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
          <TasksSidebar
            tasksToShow={tasksToShow}
            tasksTitle={tasksTitle}
            hasTasks={hasTasks}
            overdueTasks={overdueTasks}
            todayTasks={todayTasks}
            upcomingTasks={upcomingTasks}
            weeklyGoals={weeklyGoals}
            monthlyGoals={monthlyGoals}
            undoneTasks={undoneTasks}
            filteredInbox={filteredInbox}
            stats={stats}
            habits={habits}
            taskActionMenuId={taskActionMenuId}
            setTaskActionMenuId={setTaskActionMenuId}
            expandedTaskIds={expandedTaskIds}
            toggleTaskExpansion={toggleTaskExpansion}
            setPreviewDocument={setPreviewDocument}
            setRescheduleTaskTarget={setRescheduleTaskTarget}
            toggleTask={toggleTask}
          />
        </div>

        {/* ── Right Column: Quick Notes (sticky chat sidebar) ─────────────────── */}
        <div className="lg:sticky lg:top-8 lg:self-start flex flex-col gap-16">
          <QuickNotesWidget 
            initialNotes={quickNotes || []} 
            workspaceId={workspaceId} 
          />

          {/* MOBILE PROGRESS */}
          <section className="lg:hidden">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider h-8 flex items-center mb-4">
              Progress
            </h2>
            <div className="bg-sidebar border border-divider rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Target className="w-4 h-4 text-accent/50" />
                  <span>Mastered</span>
                </div>
                <span className="text-sm font-semibold text-muted">{stats.mastered} / {stats.totalTopics}</span>
              </div>
              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalTopics > 0 ? (stats.mastered / stats.totalTopics) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Zap className="w-4 h-4 text-amber-400/50" />
                  <span>In progress</span>
                </div>
                <span className="text-sm font-semibold text-muted">{stats.inProgress}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Inbox className="w-4 h-4 text-accent/50" />
                  <span>Inbox ({filteredInbox.length})</span>
                </div>
                <span className="text-sm font-semibold text-muted"></span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <BookOpen className="w-4 h-4 text-muted" />
                  <span>Not started</span>
                </div>
                <span className="text-sm font-semibold text-muted">{stats.notStarted}</span>
              </div>
            </div>
          </section>
        </div>
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
      
      <DayDebriefModal
        isOpen={isDayDebriefOpen}
        onClose={() => setIsDayDebriefOpen(false)}
        workspaceId={workspaceId}
        todaySlots={todaySlots}
        date={startOfToday}
      />

      <WeeklyReviewModal />

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

      {/* Monday Weekly Review */}
      <WeeklyReviewModal />
    </div>
  );
}
