'use client';

import { useState, startTransition } from 'react';
import {
  BookOpen,
  Plus,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Clock,
  Link as LinkIcon,
  Pin,
  Edit3,
  Circle,
  CheckCircle2,
  Lock,
  Menu,
  Grid,
  MoreVertical,
  Play
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { createTopic } from '@/app/actions/topic.actions';
import { KnowledgeGraphModal } from '@/components/navigation/KnowledgeGraphModal';
import { SubjectVault } from '@/components/subject/SubjectVault';
import { toast } from 'sonner';

// Types matching what getSubjectById returns
interface Revision {
  id: string;
  cycleNumber: number;
  status: string;
  scheduledFor: Date;
}

interface TopicData {
  id: string;
  title: string;
  tags: string[];
  sortOrder: number | null;
  updatedAt: Date;
  revisions: Revision[];
}

interface CaptureData {
  id: string;
  type: 'NOTE' | 'LINK' | 'TASK';
  content: string | null;
  title: string | null;
  url: string | null;
  createdAt: Date;
  category: { name: string } | null;
  revisions?: Revision[];
}

interface ActivityData {
  id: string;
  action: string;
  details: string | null;
  createdAt: Date;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
}

interface DailyHistoryData {
  id: string;
  date: Date;
  revisionsDue: number;
  revisionsDone: number;
  streakMaintained: boolean;
}

interface SubjectData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  topics: TopicData[];
  captures: CaptureData[];
}

interface SubjectContentProps {
  subject: SubjectData;
  activities: ActivityData[];
  streak: StreakData | null;
  dailyHistory: DailyHistoryData[];
}

export function SubjectContent({ subject, activities, streak, dailyHistory }: SubjectContentProps) {
  const router = useRouter();
  const { setRevisionQueue } = useAppStore();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  const handleCreateTopic = async () => {
    setIsCreatingTopic(true);
    try {
      const newTopic = await createTopic(subject.id, "Untitled Topic");
      router.push(`/topic/${newTopic.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create topic');
      setIsCreatingTopic(false);
    }
  };

  // Derive topic display data from real revisions
  const allTopics = subject.topics.map(topic => {
    const total = topic.revisions.length;
    const progress = topic.revisions.filter(r => r.status === 'done').length;
    return {
      id: topic.id,
      title: topic.title,
      progress,
      total,
      tags: topic.tags,
      lastActive: timeAgo(topic.updatedAt),
      isLocked: total > 0 && progress === total,
    };
  });

  // Compute stats
  const totalTopics = allTopics.length;
  const completedTopics = allTopics.filter(t => t.isLocked).length;
  const inProgressTopics = allTopics.filter(t => t.total > 0 && !t.isLocked).length;
  const notStartedTopics = allTopics.filter(t => t.total === 0).length;

  // Find topics and quickNotes with upcoming revisions
  const now = new Date();
  
  const topicRevisionsDue = subject.topics
    .filter(t => t.revisions.some(r => r.status === 'pending'))
    .map(t => {
      const nextPending = t.revisions
        .filter(r => r.status === 'pending')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
      return {
        id: t.id,
        title: t.title,
        tags: t.tags,
        cycleNumber: nextPending?.cycleNumber ?? 0,
        scheduledFor: nextPending ? new Date(nextPending.scheduledFor) : now,
        isQuickNote: false
      };
    });

  const quickNoteRevisionsDue = (subject.captures || [])
    .filter(c => c.type === 'NOTE' && c.revisions && c.revisions.some(r => r.status === 'pending'))
    .map(qn => {
      const nextPending = qn.revisions!
        .filter(r => r.status === 'pending')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
      return {
        id: qn.id,
        title: qn.title || (qn.content || '').substring(0, 30) + '...',
        tags: [] as string[],
        cycleNumber: nextPending?.cycleNumber ?? 0,
        scheduledFor: nextPending ? new Date(nextPending.scheduledFor) : now,
        isQuickNote: true
      };
    });

  const revisionsDue = [...topicRevisionsDue, ...quickNoteRevisionsDue]
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

  // Find the most recently edited topic for "Continue where you left off"
  const lastEditedTopic = subject.topics.length > 0
    ? [...subject.topics].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    : null;
  const lastEditedDisplay = lastEditedTopic ? {
    ...allTopics.find(t => t.id === lastEditedTopic.id)!,
  } : null;

  const uniqueTags = Array.from(new Set(allTopics.flatMap(t => t.tags)));

  const displayedTopics = selectedTag
    ? allTopics.filter(t => t.tags.includes(selectedTag))
    : allTopics;

  // Helper: format relative date for revisions
  function formatDueDate(date: Date): string {
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  }

  const handleStartRevision = () => {
    // Only queue topics that are overdue or due today
    const dueTopics = revisionsDue.filter(t => {
      const diffMs = t.scheduledFor.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= 0;
    });

    if (dueTopics.length === 0) return;

    // Set queue to simplified topic objects
    startTransition(() => {
      setRevisionQueue(dueTopics.map(t => ({ id: t.id, title: t.title, isQuickNote: t.isQuickNote })));
      // Navigate to the first topic in the queue if it's a topic
      if (!dueTopics[0].isQuickNote) {
        router.push(`/topic/${dueTopics[0].id}`);
      } else {
        // If it's a QuickNote, do nothing for now (UI pending)
        // Just let it be in the queue state
      }
    });
  };

  // Streak chart data (last 7 days)
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const streakChartData = (() => {
    if (dailyHistory.length === 0) {
      return dayLabels.map(day => ({ day, h: 'h-1' }));
    }
    const maxDone = Math.max(...dailyHistory.map(d => d.revisionsDone), 1);
    return dailyHistory.slice(-7).map((d, i) => {
      const ratio = d.revisionsDone / maxDone;
      const h = ratio > 0.75 ? 'h-8' : ratio > 0.5 ? 'h-6' : ratio > 0.25 ? 'h-4' : ratio > 0 ? 'h-2' : 'h-1';
      return { day: dayLabels[i % 7], h };
    });
  })();

  return (
    <div className="p-8 max-w-[1100px] mx-auto w-full h-full flex flex-col">

      {/* Header */}
      <header className="flex flex-col gap-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-accent" />
              {subject.name}
              <Edit3 className="w-4 h-4 text-foreground/40 hover:text-foreground cursor-pointer transition-colors ml-1" />
            </h1>
            <p className="text-foreground/60 text-sm">
              {totalTopics} topics · {revisionsDue.length} due for revision · Last active: {timeAgo(subject.lastActiveAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                placeholder="Search topics..."
                className="bg-sidebar border border-divider rounded-md pl-9 pr-3 py-2 text-sm w-64 focus:outline-none focus:border-accent"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="bg-background/50 text-[10px] px-1.5 py-0.5 rounded border border-divider text-foreground/40 font-sans">⌘K</kbd>
              </div>
            </div>
            <button 
              onClick={handleCreateTopic}
              disabled={isCreatingTopic}
              className="flex items-center gap-2 bg-accent hover:bg-[#026EC1] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {isCreatingTopic ? 'Creating...' : 'New Topic'}
            </button>
            <button className="p-2 border border-divider rounded-md hover:bg-hover text-foreground/70 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

      </header>

      <div className="h-[1px] w-full bg-divider mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-12">
        {/* Left Column */}
        <div className="flex flex-col space-y-10">
          {/* CONTINUE WHERE YOU LEFT OFF */}
          {lastEditedDisplay && (
          <section>
        <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
          <ChevronDown className="w-4 h-4" /> CONTINUE WHERE YOU LEFT OFF
        </h2>
        <div className="bg-sidebar border border-divider rounded-lg p-5 flex flex-col gap-3 group hover:border-accent/50 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-accent" /> {lastEditedDisplay.title}
              {lastEditedDisplay.tags[0] && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase ml-1">
                  {lastEditedDisplay.tags[0].replace('#', '')}
                </span>
              )}
            </h3>
            <span className="text-xs text-foreground/40">Last edited: {lastEditedDisplay.lastActive}</span>
          </div>
          <div className="flex justify-between items-end mt-2">
            <div className="flex items-center gap-3 w-64">
              {lastEditedDisplay.total > 0 ? (
                <>
                  <div className="w-full h-1.5 bg-background rounded-full overflow-hidden flex">
                    <div className="h-full bg-accent" style={{ width: `${(lastEditedDisplay.progress / lastEditedDisplay.total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-foreground/50 w-6">{lastEditedDisplay.progress}/{lastEditedDisplay.total}</span>
                </>
              ) : (
                <span className="text-xs text-foreground/40 italic">Not started</span>
              )}
            </div>
            <Link href={`/topic/${lastEditedDisplay.id}`} className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              Continue <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
          )}

      {/* REVISIONS DUE */}
      {revisionsDue.length > 0 && (
      <section>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-foreground">
              <ChevronDown className="w-4 h-4" /> REVISION DUE (FOR THIS SUBJECT)
            </h2>
            <span className="text-xs text-foreground/50 font-medium">({revisionsDue.length} topics)</span>
          </div>
          <button 
            onClick={handleStartRevision}
            className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Start Revision Queue
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {revisionsDue.slice(0, 3).map(rev => (
            <Link key={rev.id} href={`/topic/${rev.id}`} className="group bg-sidebar border border-divider rounded-lg p-4 hover:bg-hover transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Circle className="w-5 h-5 text-foreground/30 group-hover:text-accent transition-colors" />
                <span className="font-medium">{rev.title}</span>
                {rev.tags[0] && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase ml-2">
                    {rev.tags[0].replace('#', '')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-foreground/50">Day {rev.cycleNumber}</span>
                <span className="text-accent font-medium w-16 text-right">{formatDueDate(rev.scheduledFor)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* ALL TOPICS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-lg flex items-center gap-1">
              All Topics
            </h2>
            <button className="text-xs bg-sidebar border border-divider px-2 py-1 rounded-md text-foreground/60 hover:text-foreground hover:bg-hover flex items-center gap-1 transition-colors">
               <Settings className="w-3 h-3" /> Manage Tags
            </button>
          </div>
          <button 
            onClick={() => setIsGraphModalOpen(true)}
            className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            <span>🕸️</span> Visualize Connections
          </button>
        </div>

        {/* Tag Filters Row */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
           <button
             onClick={() => setSelectedTag(null)}
             className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
               selectedTag === null
                 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                 : 'bg-transparent text-foreground/50 border-transparent hover:bg-sidebar/50 hover:text-foreground'
             }`}
           >
             All <span className="opacity-60 ml-1">({allTopics.length})</span>
           </button>

           {uniqueTags.map(tag => {
              const count = allTopics.filter(t => t.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors uppercase shrink-0 ${
                    selectedTag === tag
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-transparent text-foreground/50 border-transparent hover:bg-sidebar/50 hover:text-foreground'
                  }`}
                >
                  {tag.replace('#', '')} <span className="opacity-60 ml-1">({count})</span>
                </button>
              );
            })}

            <button className="text-[9px] px-2 py-0.5 rounded-full text-foreground/50 hover:bg-sidebar/50 transition-colors ml-auto shrink-0 flex items-center">
               ... <ChevronRight className="w-3 h-3 ml-1" />
            </button>
        </div>

        {/* Filter and Sort Bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              placeholder="Filter topics..."
              className="bg-sidebar border border-divider rounded-md pl-9 pr-3 py-1.5 text-sm w-64 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm text-foreground/60">
                Sort: <span className="text-foreground hover:text-accent cursor-pointer flex items-center font-medium">Recent <ChevronDown className="w-3 h-3 ml-1" /></span>
             </div>
             <div className="flex items-center border border-divider rounded-md overflow-hidden bg-sidebar">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-accent/20 text-accent' : 'text-foreground/40 hover:bg-hover'}`}
                ><Menu className="w-4 h-4" /></button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-accent/20 text-accent' : 'text-foreground/40 hover:bg-hover'}`}
                ><Grid className="w-4 h-4" /></button>
             </div>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="bg-sidebar border border-divider rounded-lg overflow-hidden">
          <div className="divide-y divide-divider">
            {displayedTopics.map(topic => (
              <div key={topic.id} className={`p-3 hover:bg-hover flex items-center justify-between transition-colors cursor-pointer group ${topic.isLocked ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-medium">{topic.title}</span>
                </div>
                <div className="flex items-center gap-4 w-[300px] justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-background rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${topic.progress === topic.total && topic.total > 0 ? 'bg-green-500' : 'bg-accent'}`}
                        style={{ width: topic.total > 0 ? `${(topic.progress / topic.total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs text-foreground/50 w-6">
                      {topic.total > 0 ? `${topic.progress}/${topic.total}` : '–'}
                    </span>
                  </div>

                  {topic.isLocked ? (
                    <div className="flex justify-center w-full">
                      <Lock className="w-3 h-3 text-green-500" />
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-center w-full">
                      {topic.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className="text-xs text-foreground/40 w-12 text-right">{topic.lastActive}</span>
                  <button className="p-1 hover:bg-background rounded text-foreground/40 hover:text-foreground transition-colors ml-2">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {displayedTopics.length === 0 && (
              <div className="p-8 text-center text-sm text-foreground/50">
                No topics found with the selected tag.
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedTopics.map(topic => (
              <div key={topic.id} className={`bg-sidebar border border-divider p-4 rounded-lg hover:border-accent/50 transition-colors flex flex-col gap-3 group cursor-pointer ${topic.isLocked ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between">
                  <span className="font-semibold text-sm">{topic.title}</span>
                  <button className="p-1 hover:bg-background rounded text-foreground/40 hover:text-foreground transition-colors -mr-1 -mt-1 opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-2 flex-1 mr-4">
                    <div className="w-full h-1.5 bg-background rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${topic.progress === topic.total && topic.total > 0 ? 'bg-green-500' : 'bg-accent'}`}
                        style={{ width: topic.total > 0 ? `${(topic.progress / topic.total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-foreground/50 whitespace-nowrap">
                      {topic.total > 0 ? `${topic.progress}/${topic.total}` : '–'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                  {topic.isLocked ? (
                    <Lock className="w-3 h-3 text-green-500" />
                  ) : (
                    <div className="flex gap-1">
                      {topic.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                          {tag.replace('#', '')}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-foreground/40">{topic.lastActive}</span>
                </div>
              </div>
            ))}

            {displayedTopics.length === 0 && (
              <div className="col-span-full p-8 text-center text-sm text-foreground/50 border border-divider rounded-lg bg-sidebar">
                No topics found with the selected tag.
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-6">
        {/* RESOURCES */}
        <section>
          <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
            <ChevronDown className="w-4 h-4" /> 🔗 RESOURCES ({subject.captures.filter(c => c.type === 'LINK').length})
          </h2>
          <div className="bg-sidebar border border-divider rounded-lg p-4 flex flex-col gap-3">
            {subject.captures.filter(c => c.type === 'LINK').length > 0 ? (
              subject.captures.filter(c => c.type === 'LINK').map(res => (
                <a key={res.id} href={res.url!} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 group">
                  <LinkIcon className="w-4 h-4 text-foreground/40 mt-0.5 group-hover:text-accent transition-colors" />
                  <div>
                    <div className="text-sm font-medium group-hover:underline">{res.title}</div>
                    <div className="text-xs text-foreground/40">{new URL(res.url!).hostname}</div>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-sm text-foreground/40 italic">No resources added yet.</p>
            )}
          </div>
        </section>

        {/* QUICK NOTES */}
        <section>
          <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
            <ChevronDown className="w-4 h-4" /> 📌 QUICK NOTES ({subject.captures.filter(c => c.type === 'NOTE').length})
          </h2>
          <div className="flex flex-col gap-3">
            {subject.captures.filter(c => c.type === 'NOTE').length > 0 ? (
              subject.captures.filter(c => c.type === 'NOTE').map(note => (
                <div key={note.id} className="bg-sidebar border border-divider rounded-lg p-3 flex gap-3 text-sm">
                  <Pin className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {note.content}
                  </div>
                  <span className="text-xs text-foreground/40 whitespace-nowrap">{timeAgo(note.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground/40 italic">No notes yet.</p>
            )}
          </div>
        </section>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="flex flex-col space-y-8 hidden lg:flex mt-7">          {/* About this subject */}
          <div>
            <h2 className="text-sm font-semibold mb-2">About this subject</h2>
            <p className="text-sm text-foreground/60 leading-relaxed">
              {subject.description || 'No description added yet.'}
            </p>
          </div>

          <div className="h-[1px] w-full bg-divider" />

          {/* Quick Stats */}
          <div>
            <h2 className="text-sm font-semibold mb-4">Quick Stats</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-foreground/70">Total Topics</span>
                </div>
                <span className="font-medium">{totalTopics}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-foreground/70">Completed</span>
                </div>
                <span className="font-medium">{completedTopics}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-foreground/70">In Progress</span>
                </div>
                <span className="font-medium">{inProgressTopics}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-foreground/20" />
                  <span className="text-foreground/70">Not Started</span>
                </div>
                <span className="font-medium">{notStartedTopics}</span>
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-divider" />

          {/* Study Streak */}
          <div>
            <h2 className="text-sm font-semibold mb-4">Study Streak</h2>
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <span className="text-3xl">🔥</span> {streak?.currentStreak ?? 0}
                </div>
                <span className="text-xs text-foreground/50 mt-1">days</span>
              </div>
              <div className="flex items-end gap-2">
                {streakChartData.map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className={`w-2 ${item.h} bg-accent rounded-t-sm`} />
                    <span className="text-[9px] text-foreground/40 font-medium">{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-divider" />

          {/* Recent Activity */}
          <div>
            <h2 className="text-sm font-semibold mb-4">Recent Activity</h2>
            <div className="flex flex-col gap-4">
              {activities.length > 0 ? (
                activities.map(activity => (
                  <div key={activity.id} className="flex justify-between items-start text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-foreground/40 mt-0.5 shrink-0" />
                      <span className="text-foreground/80">
                        {activity.action === 'CREATED_TOPIC' && `Created "${activity.details}"`}
                        {activity.action === 'EDITED_TOPIC' && `Edited "${activity.details}"`}
                        {activity.action === 'COMPLETED_REVISION' && `Reviewed "${activity.details}"`}
                      </span>
                    </div>
                    <span className="text-xs text-foreground/40 whitespace-nowrap">{timeAgo(activity.createdAt)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground/40 italic">No activity yet.</p>
              )}
            </div>
            {activities.length > 0 && (
              <Link href="#" className="text-sm font-medium text-accent hover:underline mt-4 inline-block">
                View all activity
              </Link>
            )}
          </div>
        </div>

      </div>

      {/* Vault Section (Resources & Quick Notes) */}
      <SubjectVault 
        subjectId={subject.id} 
        captures={subject.captures} 
      />

      {isGraphModalOpen && (
        <KnowledgeGraphModal 
          topics={allTopics} 
          onClose={() => setIsGraphModalOpen(false)} 
        />
      )}
    </div>
  );
}
