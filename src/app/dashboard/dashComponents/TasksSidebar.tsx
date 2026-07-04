'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Calendar,
  Target,
  Zap,
  X,
  Paperclip,
  Inbox,
  BookOpen,
} from 'lucide-react';
import { TaskActionMenu } from '@/components/dashboard/TaskActionMenu';
import type { TaskProp, InboxProp, StatsProp, PreviewDocument } from '../DashboardClient';

// ────────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ────────────────────────────────────────────────────────────────────────────────

function AttachmentThumbnails({
  attachments,
  fallbackTitle,
  dimmed,
  onPreview,
}: {
  attachments: NonNullable<TaskProp['attachments']>;
  fallbackTitle: string;
  dimmed?: boolean;
  onPreview: (doc: PreviewDocument) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, idx) => {
        const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
        return (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              onPreview({
                id: att.url,
                title: att.fileName || fallbackTitle || 'Attachment',
                url: att.url,
                category: isImg ? 'image' : 'file',
                thumbnailUrl: isImg ? att.url : undefined,
                addedAt: '',
              });
            }}
            className="block"
          >
            {isImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={att.url} alt="Attachment" className={`w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity ${dimmed ? 'opacity-40' : ''}`} />
            ) : (
              <div className={`flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors ${dimmed ? 'opacity-40' : ''}`}>
                <Paperclip className="w-3 h-3 text-foreground/50" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// PROPS
// ────────────────────────────────────────────────────────────────────────────────

interface TasksSidebarProps {
  tasksToShow: TaskProp[];
  tasksTitle: string;
  hasTasks: boolean;
  overdueTasks: TaskProp[];
  todayTasks: TaskProp[];
  upcomingTasks: TaskProp[];
  undoneTasks: TaskProp[];
  filteredInbox: InboxProp[];
  stats: StatsProp;
  taskActionMenuId: string | null;
  setTaskActionMenuId: (id: string | null) => void;
  expandedTaskIds: Set<string>;
  toggleTaskExpansion: (id: string) => void;
  setPreviewDocument: (doc: PreviewDocument | null) => void;
  setRescheduleTaskTarget: (target: any | null) => void;
  toggleTask: (id: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

export default function TasksSidebar({
  tasksToShow,
  tasksTitle,
  hasTasks,
  overdueTasks,
  todayTasks,
  upcomingTasks,
  undoneTasks,
  filteredInbox,
  stats,
  taskActionMenuId,
  setTaskActionMenuId,
  expandedTaskIds,
  toggleTaskExpansion,
  setPreviewDocument,
  setRescheduleTaskTarget,
  toggleTask,
}: TasksSidebarProps) {
  const [isAllTasksModalOpen, setIsAllTasksModalOpen] = useState(false);
  const [activeTaskTab, setActiveTaskTab] = useState<'overdue' | 'today' | 'upcoming'>('today');

  return (
    <div className="flex flex-col space-y-8">

      {/* TASKS */}
      {hasTasks && (
        <section>
          <div className="flex justify-between items-center h-8 mb-4">
            <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-2">
              {tasksTitle}
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-foreground/5 text-foreground/40 border border-divider normal-case tracking-normal font-bold">
                {tasksToShow.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAllTasksModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-accent font-medium transition-colors"
              >
                All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {tasksToShow.map(task => (
              <div
                key={task.id}
                onClick={() => toggleTaskExpansion(task.id)}
                className={`group bg-sidebar border border-divider rounded-lg px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                  task.isDone ? 'opacity-50' : 'hover:bg-hover'
                }`}
              >
                <TaskActionMenu
                  task={task}
                  isOpen={taskActionMenuId === task.id}
                  onToggle={() => toggleTask(task.id)}
                  onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
                  onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
                  onClose={() => setTaskActionMenuId(null)}
                  circleColorClass="text-foreground/30"
                  hoverColorClass="group-hover/btn:text-accent group-hover:text-foreground/50"
                  sizeClass="w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(task.id) ? '' : 'line-clamp-2'} ${task.isDone ? 'text-foreground/20' : 'text-foreground/50'}`}>
                      {task.description}
                    </p>
                  )}
                  {task.attachments && task.attachments.length > 0 && (
                    <AttachmentThumbnails attachments={task.attachments} fallbackTitle={task.title} dimmed={task.isDone} onPreview={setPreviewDocument} />
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {task.isOverdue && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-red-500/10 text-red-400 border border-red-500/20 font-bold uppercase tracking-wider">
                        Overdue
                      </span>
                    )}
                    {task.type === 'reminder' && !task.isOverdue && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        REMINDER
                      </span>
                    )}
                    {(task.dueDate || task.time) && (
                      <span className="text-[10px] text-foreground/40 font-mono">
                        {(() => {
                          const dateToFormat = task.dueDate || task.time;
                          if (!dateToFormat) return null;
                          if (typeof dateToFormat === 'string' && dateToFormat.includes('T')) {
                            const d = new Date(dateToFormat);
                            if (!isNaN(d.getTime())) {
                              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }
                          } else if (dateToFormat instanceof Date) {
                            return dateToFormat.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          }
                          return task.time;
                        })()}
                      </span>
                    )}
                    {task.source && (
                      <ExternalLink className="w-3 h-3 text-foreground/20 group-hover:text-accent/50 transition-colors" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* INBOX */}
      {filteredInbox.length > 0 && (
        <section>
          <div className="flex justify-between items-center h-8 mb-4">
            <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
              Inbox
            </h2>
            <button className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-accent font-medium transition-colors">
              All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {filteredInbox.slice(0, 5).map(item => (
              <div
                key={item.id}
                className="group bg-sidebar border border-divider rounded-lg px-4 py-3 hover:bg-hover transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'link' && <Link2 className="w-4 h-4 text-accent/50" />}
                    {item.type === 'file' && <FileText className="w-4 h-4 text-amber-400/50" />}
                    {item.type === 'note' && <FileText className="w-4 h-4 text-emerald-400/50" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-snug text-foreground/90">{item.title}</p>
                    {item.attachments && item.attachments.length > 0 && (
                      <AttachmentThumbnails attachments={item.attachments} fallbackTitle={item.title} onPreview={setPreviewDocument} />
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.tags?.map(tag => (
                        <span key={tag} className="text-[10px] text-foreground/40 font-medium mr-1.5">
                          {tag.replace('#', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PROGRESS */}
      <section>
        <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider h-8 flex items-center mb-4">
          Progress
        </h2>
        <div className="bg-sidebar border border-divider rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Target className="w-4 h-4 text-accent/50" />
              <span>Mastered</span>
            </div>
            <span className="text-sm font-semibold text-foreground/70">{stats.mastered} / {stats.totalTopics}</span>
          </div>
          <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${stats.totalTopics > 0 ? (stats.mastered / stats.totalTopics) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Zap className="w-4 h-4 text-amber-400/50" />
              <span>In progress</span>
            </div>
            <span className="text-sm font-semibold text-foreground/70">{stats.inProgress}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Inbox className="w-4 h-4 text-accent/50" />
              <span>Inbox ({filteredInbox.length})</span>
            </div>
            <span className="text-sm font-semibold text-foreground/70"></span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <BookOpen className="w-4 h-4 text-foreground/30" />
              <span>Not started</span>
            </div>
            <span className="text-sm font-semibold text-foreground/70">{stats.notStarted}</span>
          </div>
        </div>
      </section>

      {/* View All Tasks Modal */}
      {isAllTasksModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsAllTasksModalOpen(false); }}
        >
          <div className="bg-[#191919] border border-divider/60 rounded-2xl w-full max-w-[720px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">

            {/* Header */}
            <div className="flex justify-between items-start px-6 pt-6 pb-4">
              <div>
                <p className="text-[11px] font-semibold text-foreground/30 uppercase tracking-widest mb-1">Task Manager</p>
                <h2 className="text-[22px] font-bold text-foreground leading-tight">All Tasks</h2>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-4 text-[11px] font-semibold text-foreground/40">
                  {overdueTasks.length > 0 && (
                    <span className="text-red-400">{overdueTasks.length} overdue</span>
                  )}
                  <span className="text-foreground/30">{undoneTasks.length} total</span>
                </div>
                <button
                  onClick={() => setIsAllTasksModalOpen(false)}
                  className="p-1.5 text-foreground/30 hover:text-foreground hover:bg-hover rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Strip */}
            <div className="px-6 pb-0">
              <div className="flex items-center gap-1 p-1 bg-background rounded-xl">
                {([
                  { key: 'overdue', label: 'Overdue', count: overdueTasks.length, activeColor: 'bg-red-500/15 text-red-400', dotColor: 'bg-red-400' },
                  { key: 'today', label: 'Today', count: todayTasks.length, activeColor: 'bg-accent/15 text-accent', dotColor: 'bg-accent' },
                  { key: 'upcoming', label: 'Upcoming', count: upcomingTasks.length, activeColor: 'bg-foreground/10 text-foreground', dotColor: 'bg-foreground/40' },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTaskTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12px] font-semibold transition-all ${
                      activeTaskTab === tab.key
                        ? tab.activeColor + ' shadow-sm'
                        : 'text-foreground/40 hover:text-foreground/70 hover:bg-hover/50'
                    }`}
                  >
                    {activeTaskTab === tab.key && <div className={`w-1.5 h-1.5 rounded-full ${tab.dotColor}`} />}
                    {tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                      activeTaskTab === tab.key ? 'bg-current/10 opacity-80' : 'bg-foreground/8 text-foreground/30'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-6 pt-2">
              <div className="flex flex-col gap-2 pb-32">

                {/* Overdue Tab */}
                {activeTaskTab === 'overdue' && (
                  overdueTasks.length > 0 ? overdueTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskExpansion(task.id)}
                      className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${
                        task.isDone ? 'opacity-50' : 'hover:bg-hover/40 hover:border-red-500/10'
                      }`}
                    >
                      {!task.isDone && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />}
                      <TaskActionMenu
                        task={task}
                        isOpen={taskActionMenuId === task.id}
                        onToggle={() => toggleTask(task.id)}
                        onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
                        onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
                        onClose={() => setTaskActionMenuId(null)}
                        circleColorClass="text-red-500/40"
                        hoverColorClass="group-hover/btn:text-red-400 group-hover:text-red-400"
                        sizeClass="w-[15px] h-[15px]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>{task.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-[11px] text-red-400/70">Overdue</p>
                          {task.tags?.map(tag => (
                            <span key={tag} className="text-[10px] text-foreground/40 font-medium ml-1">
                              {tag.replace('#', '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center h-full text-center pb-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
                      </div>
                      <p className="text-[15px] font-semibold text-foreground/70">All caught up!</p>
                      <p className="text-[12px] text-foreground/35 mt-1">No overdue tasks. Great work.</p>
                    </div>
                  )
                )}

                {/* Today Tab */}
                {activeTaskTab === 'today' && (
                  todayTasks.length > 0 ? todayTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskExpansion(task.id)}
                      className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${
                        task.isDone ? 'opacity-50' : 'hover:bg-hover/40 hover:border-accent/10'
                      }`}
                    >
                      {!task.isDone && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full bg-accent/30 group-hover:bg-accent transition-colors" />}
                      <TaskActionMenu
                        task={task}
                        isOpen={taskActionMenuId === task.id}
                        onToggle={() => toggleTask(task.id)}
                        onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
                        onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
                        onClose={() => setTaskActionMenuId(null)}
                        circleColorClass="text-foreground/20"
                        hoverColorClass="group-hover/btn:text-accent group-hover:text-accent"
                        sizeClass="w-[15px] h-[15px]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>{task.title}</p>
                        {task.description && (
                          <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(task.id) ? '' : 'line-clamp-2'} ${task.isDone ? 'text-foreground/20' : 'text-foreground/50'}`}>
                            {task.description}
                          </p>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                          <AttachmentThumbnails attachments={task.attachments} fallbackTitle={task.title} dimmed={task.isDone} onPreview={setPreviewDocument} />
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {task.time && <p className="text-[11px] text-foreground/35 font-mono">{task.time}</p>}
                          {task.tags?.map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-foreground/5 text-foreground/30 border border-divider uppercase">
                              {tag.replace('#', '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center h-full text-center pb-4">
                      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-6 h-6 text-accent/50" />
                      </div>
                      <p className="text-[15px] font-semibold text-foreground/70">Nothing due today</p>
                      <p className="text-[12px] text-foreground/35 mt-1">Take a breath or plan ahead.</p>
                    </div>
                  )
                )}

                {/* Upcoming Tab */}
                {activeTaskTab === 'upcoming' && (
                  upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskExpansion(task.id)}
                      className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${
                        task.isDone ? 'opacity-50' : 'hover:bg-hover/40 hover:border-divider'
                      }`}
                    >
                      {!task.isDone && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full bg-foreground/10 group-hover:bg-foreground/30 transition-colors" />}
                      <TaskActionMenu
                        task={task}
                        isOpen={taskActionMenuId === task.id}
                        onToggle={() => toggleTask(task.id)}
                        onReschedule={() => { setRescheduleTaskTarget(task); setTaskActionMenuId(null); }}
                        onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(task.id); }}
                        onClose={() => setTaskActionMenuId(null)}
                        circleColorClass="text-foreground/20"
                        hoverColorClass="group-hover/btn:text-foreground/50 group-hover:text-foreground/50"
                        sizeClass="w-[15px] h-[15px]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium leading-snug ${task.isDone ? 'line-through text-foreground/30' : 'text-foreground/90'}`}>{task.title}</p>
                        {task.description && (
                          <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(task.id) ? '' : 'line-clamp-2'} ${task.isDone ? 'text-foreground/20' : 'text-foreground/50'}`}>
                            {task.description}
                          </p>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                          <AttachmentThumbnails attachments={task.attachments} fallbackTitle={task.title} dimmed={task.isDone} onPreview={setPreviewDocument} />
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {task.dueDate && (
                            <p className="text-[11px] text-foreground/35">
                              {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                          )}
                          {task.tags?.map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-foreground/5 text-foreground/30 border border-divider uppercase">
                              {tag.replace('#', '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center h-full text-center pb-4">
                      <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4">
                        <Calendar className="w-6 h-6 text-foreground/25" />
                      </div>
                      <p className="text-[15px] font-semibold text-foreground/70">Schedule is clear</p>
                      <p className="text-[12px] text-foreground/35 mt-1">No tasks planned ahead.</p>
                    </div>
                  )
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}