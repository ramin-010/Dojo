'use client';

import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  BookOpen,
  Play,
  Zap,
  Paperclip,
} from 'lucide-react';
import { TaskActionMenu } from '@/components/dashboard/TaskActionMenu';
import type { RevisionProp, PreviewDocument } from '../DashboardClient';

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS (local to revisions)
// ────────────────────────────────────────────────────────────────────────────────

function getCycleName(intervalDays: number): string {
  if (intervalDays === 1) return 'Day 1';
  if (intervalDays === 3) return 'Day 3';
  if (intervalDays === 7) return 'Day 7';
  if (intervalDays === 21) return 'Day 21';
  return `Day ${intervalDays}`;
}

// Small shared renderer so overdue / today / completed blocks don't triplicate this JSX.
function AttachmentThumbnails({
  attachments,
  fallbackTitle,
  dimmed,
  onPreview,
}: {
  attachments: NonNullable<RevisionProp['attachments']>;
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

interface RevisionsListProps {
  incompleteOverdueRevisions: RevisionProp[];
  groupedIncompleteTodayRevisions: Record<string, RevisionProp[]>;
  completedRevisions: RevisionProp[];
  totalDue: number;
  taskActionMenuId: string | null;
  setTaskActionMenuId: (id: string | null) => void;
  expandedTaskIds: Set<string>;
  toggleTaskExpansion: (id: string) => void;
  setPreviewDocument: (doc: PreviewDocument | null) => void;
  setRescheduleTaskTarget: (target: any | null) => void;
}

// ────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

export default function RevisionsList({
  incompleteOverdueRevisions,
  groupedIncompleteTodayRevisions,
  completedRevisions,
  totalDue,
  taskActionMenuId,
  setTaskActionMenuId,
  expandedTaskIds,
  toggleTaskExpansion,
  setPreviewDocument,
  setRescheduleTaskTarget,
}: RevisionsListProps) {
  const router = useRouter();

  return (
    <section>
      <div className="flex justify-between items-center h-8 mb-4">
        <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-2">
          Revisions Due
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/20 normal-case tracking-normal font-bold">
            {totalDue}
          </span>
        </h2>
        {totalDue > 0 && (
          <button className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
            <Play className="w-3.5 h-3.5 fill-current" /> Start Revision
          </button>
        )}
      </div>

      {/* Unified revision list — overdue first, then today */}
      <div className="flex flex-col gap-2">
        {/* Overdue items (Incomplete) */}
        {incompleteOverdueRevisions.map(rev => (
          <div
            key={rev.id}
            onClick={() => {
              if (!rev.isQuickNote) {
                router.push(`/topic/${rev.topicId}`);
              } else {
                toggleTaskExpansion(rev.id);
              }
            }}
            className={`group bg-sidebar border border-[#f48771]/15 rounded-lg p-4 transition-colors flex items-center justify-between cursor-pointer ${taskActionMenuId === rev.id ? 'relative z-50' : ''} hover:bg-hover`}
          >
            <div className="flex items-center gap-3">
              <div className="task-action-menu-container" onClick={(e) => e.stopPropagation()}>
                <TaskActionMenu
                  task={rev}
                  isOpen={taskActionMenuId === rev.id}
                  onToggle={async () => {
                    const { toggleRevision } = await import('@/app/actions/planner.actions');
                    await toggleRevision(rev.id, !rev.isDone);
                  }}
                  onReschedule={() => { setRescheduleTaskTarget({ id: rev.id, type: 'revision', title: rev.topicTitle }); setTaskActionMenuId(null); }}
                  onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(rev.id); }}
                  onClose={() => setTaskActionMenuId(null)}
                  circleColorClass="text-[#f48771]/40"
                  hoverColorClass="group-hover/btn:text-[#f48771] group-hover:text-[#f48771]"
                  sizeClass="w-5 h-5"
                  labels={{ complete: "Complete", reschedule: "Reschedule" }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{rev.topicTitle}</span>
                  {rev.tags[0] && (
                    <div className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2">
                      <span className="text-[10px] text-foreground/40 font-medium">
                        #{rev.tags[0].replace('#', '')}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">
                  {rev.subjectName}
                  <span className="text-foreground/20 mx-0.5">•</span>
                  {rev.isQuickNote ? (
                    <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
                  ) : (
                    <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
                  )}
                  <span className="text-foreground/20 mx-0.5">•</span>
                  Cycle {rev.cycleNumber} of 4
                </p>
                {rev.isQuickNote && rev.description && (
                  <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'} text-foreground/50`}>
                    {rev.description}
                  </p>
                )}
                {rev.isQuickNote && rev.attachments && rev.attachments.length > 0 && (
                  <AttachmentThumbnails attachments={rev.attachments} fallbackTitle={rev.topicTitle} onPreview={setPreviewDocument} />
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-[#f48771] flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" /> Overdue ({getCycleName(rev.intervalDays)})
            </span>
          </div>
        ))}

        {/* Today items (Incomplete) */}
        {Object.entries(groupedIncompleteTodayRevisions).map(([subjectId, revisions]) => (
          revisions.map(rev => (
            <div
              key={rev.id}
              onClick={() => {
                if (!rev.isQuickNote) {
                  router.push(`/topic/${rev.topicId}`);
                } else {
                  toggleTaskExpansion(rev.id);
                }
              }}
              className={`group bg-sidebar border border-divider rounded-lg p-4 transition-colors flex items-center justify-between cursor-pointer ${taskActionMenuId === rev.id ? 'relative z-50' : ''} ${rev.isDone ? 'opacity-50' : 'hover:bg-hover'}`}
            >
              <div className="flex items-center gap-3">
                <div className="task-action-menu-container" onClick={(e) => e.stopPropagation()}>
                  <TaskActionMenu
                    task={rev}
                    isOpen={taskActionMenuId === rev.id}
                    onToggle={async () => {
                      const { toggleRevision } = await import('@/app/actions/planner.actions');
                      await toggleRevision(rev.id, true);
                    }}
                    onReschedule={() => { setRescheduleTaskTarget({ id: rev.id, type: 'revision', title: rev.topicTitle }); setTaskActionMenuId(null); }}
                    onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(rev.id); }}
                    onClose={() => setTaskActionMenuId(null)}
                    circleColorClass="text-foreground/30"
                    hoverColorClass="group-hover/btn:text-accent group-hover:text-accent"
                    sizeClass="w-5 h-5"
                    labels={{ complete: "Complete", reschedule: "Reschedule" }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rev.topicTitle}</span>
                    {rev.tags[0] && (
                      <div className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2">
                        <span className="text-[10px] text-foreground/40 font-medium">
                          #{rev.tags[0].replace('#', '')}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">
                    {rev.subjectName}
                    <span className="text-foreground/20 mx-0.5">•</span>
                    {rev.isQuickNote ? (
                      <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
                    ) : (
                      <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
                    )}
                    <span className="text-foreground/20 mx-0.5">•</span>
                    Cycle {rev.cycleNumber} of 4
                  </p>
                  {rev.isQuickNote && rev.description && (
                    <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'} text-foreground/50`}>
                      {rev.description}
                    </p>
                  )}
                  {rev.isQuickNote && rev.attachments && rev.attachments.length > 0 && (
                    <AttachmentThumbnails attachments={rev.attachments} fallbackTitle={rev.topicTitle} onPreview={setPreviewDocument} />
                  )}
                </div>
              </div>
              <span className="text-sm text-foreground/40 font-medium shrink-0">{getCycleName(rev.intervalDays)}</span>
            </div>
          ))
        ))}

        {/* Completed Items (Both Overdue & Today) */}
        {completedRevisions.length > 0 && (
          <>
            {completedRevisions.map(rev => (
              <div
                key={rev.id}
                onClick={() => {
                  if (!rev.isQuickNote) {
                    router.push(`/topic/${rev.topicId}`);
                  } else {
                    toggleTaskExpansion(rev.id);
                  }
                }}
                className={`group bg-sidebar border border-divider rounded-lg p-4 transition-colors flex items-center justify-between cursor-pointer opacity-50 hover:opacity-75 ${taskActionMenuId === rev.id ? 'relative z-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="task-action-menu-container" onClick={(e) => e.stopPropagation()}>
                    <TaskActionMenu
                      task={rev}
                      isOpen={taskActionMenuId === rev.id}
                      onToggle={async () => {
                        const { toggleRevision } = await import('@/app/actions/planner.actions');
                        await toggleRevision(rev.id, !rev.isDone);
                      }}
                      onReschedule={() => { setRescheduleTaskTarget({ id: rev.id, type: 'revision', title: rev.topicTitle }); setTaskActionMenuId(null); }}
                      onOpen={(e) => { e.stopPropagation(); setTaskActionMenuId(rev.id); }}
                      onClose={() => setTaskActionMenuId(null)}
                      circleColorClass="text-emerald-500/70"
                      hoverColorClass="group-hover/btn:text-emerald-500 group-hover:text-emerald-500/70"
                      sizeClass="w-5 h-5"
                      labels={{ complete: "Unmark", reschedule: "Reschedule" }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground line-through text-foreground/50">{rev.topicTitle}</span>
                      {rev.tags[0] && (
                        <div className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2 opacity-50">
                          <span className="text-[10px] text-foreground/40 font-medium">
                            #{rev.tags[0].replace('#', '')}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">
                      {rev.subjectName}
                      <span className="text-foreground/20 mx-0.5">•</span>
                      {rev.isQuickNote ? (
                        <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
                      ) : (
                        <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
                      )}
                      <span className="text-foreground/20 mx-0.5">•</span>
                      Cycle {rev.cycleNumber} of 4
                    </p>
                    {rev.isQuickNote && rev.description && (
                      <p className={`text-[10px] mt-1 whitespace-pre-wrap ${expandedTaskIds.has(rev.id) ? '' : 'line-clamp-2'} text-foreground/20`}>
                        {rev.description}
                      </p>
                    )}
                    {rev.isQuickNote && rev.attachments && rev.attachments.length > 0 && (
                      <AttachmentThumbnails attachments={rev.attachments} fallbackTitle={rev.topicTitle} dimmed onPreview={setPreviewDocument} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {totalDue === 0 && (
          <div className="bg-sidebar border border-divider rounded-lg p-8 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-2" />
            <p className="font-medium text-foreground/80">You&apos;re all caught up!</p>
            <p className="text-sm text-foreground/40 mt-1">No revisions due today.</p>
          </div>
        )}
      </div>
    </section>
  );
}