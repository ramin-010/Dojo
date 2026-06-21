'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { ArrowLeft, Clock, Calendar, CheckCircle2, X, Link as LinkIcon, FileText, Globe, ChevronLeft, ChevronRight, Plus, Menu, MoreHorizontal, PlayCircle, Loader2, Info, Settings } from "lucide-react";
import Link from "next/link";
import { TopicCanvas } from "@/components/canvas/TopicCanvas";
import { TopicLinksTimeline } from './TopicLinksTimeline';
import { timeAgo } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { startTopicRevisions, completeRevision, updateTopic, createTopic } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { TopicHistoryModal } from './TopicHistoryModal';
import { TopicSettingsModal } from './TopicSettingsModal';

export type SidebarTab = 'links' | 'notes' | 'resources';

// Types matching what getTopicById returns (serialized from server)
interface TopicWorkspaceProps {
  topic: {
    id: string;
    title: string;
    tags: { id: string; name: string }[];
    canvasData: unknown;
    subjectId: string;
    sortOrder: number | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    subject: { id: string; name: string };
    revisions: {
      id: string;
      cycleNumber: number;
      intervalDays: number;
      scheduledFor: Date | string;
      completedAt: Date | string | null;
      status: string;
      createdAt: Date | string;
    }[];
    mentionsOut: {
      id: string;
      createdAt: Date | string;
      targetTopic: { id: string; title: string; updatedAt: Date | string };
    }[];
    mentionsIn: {
      id: string;
      createdAt: Date | string;
      sourceTopic: { id: string; title: string; updatedAt: Date | string };
    }[];
    resources: {
      id: string;
      url: string;
      title: string;
      category: string;
      createdAt: Date | string;
    }[];
    quickNotes: {
      id: string;
      content: string;
      isSubjectLevel: boolean;
      topicId: string | null;
      subjectId: string;
      createdAt: Date | string;
    }[];
  };
  allSubjectTags: { id: string; name: string }[];
}

export function TopicWorkspace({ topic, allSubjectTags }: TopicWorkspaceProps) {
  const { updateTopicTitle, isSaving, setIsSaving } = useAppStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('links');
  const [previewTopicId, setPreviewTopicId] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const router = useRouter();
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(384); // Default w-96 = 384px

  const [isDragging, setIsDragging] = useState(false);
  
  const [title, setTitle] = useState(topic.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLHeadingElement>(null);

  // Stable reference for contentEditable to prevent React from resetting the text mid-typing
  const prevTopicId = useRef(topic.id);
  const initialTitleHtml = useRef({ __html: topic.title || 'Untitled Topic' });
  if (prevTopicId.current !== topic.id) {
    prevTopicId.current = topic.id;
    initialTitleHtml.current = { __html: topic.title || 'Untitled Topic' };
  }

  const [tags, setTags] = useState<{ id: string; name: string }[]>(topic.tags);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<{ id: string; name: string }[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // Debounced title save
  useEffect(() => {
    if (title === topic.title) return;
    const timer = setTimeout(async () => {
      setIsSaving(true);
      await updateTopic(topic.id, { title });
      setIsSaving(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, topic.id, topic.title, setIsSaving]);

  // Synchronous zero-latency client-side tag search
  useEffect(() => {
    if (!newTagText.trim()) {
      setSuggestedTags([]);
      return;
    }
    const results = allSubjectTags
      .filter(t => t.name.toLowerCase().includes(newTagText.toLowerCase()))
      .slice(0, 10);
    setSuggestedTags(results);
  }, [newTagText, allSubjectTags]);

  const handleCommitTag = async (tagName: string) => {
    const tag = tagName.startsWith('#') ? tagName.trim() : `#${tagName.trim()}`;
    if (!tags.find(t => t.name === tag)) {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const newTags = [...tags, { id: tempId, name: tag }];
      setTags(newTags);
      
      // Save strings to backend (which connectOrCreates Tag models)
      await updateTopic(topic.id, { tags: newTags.map(t => t.name) });
    }
    setNewTagText('');
    setIsAddingTag(false);
    setSuggestedTags([]);
  };
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 40);
  };
  
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(900);
  const rafRef = useRef<number>(0);
  const resizeRafRef = useRef<number>(0);

  // Measure the actual available width for the canvas area (RAF-throttled)
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        for (const entry of entries) {
          setCanvasContainerWidth(entry.contentRect.width);
        }
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        // Calculate new width from the right edge
        const newWidth = window.innerWidth - e.clientX;
        // Ensure center has at least 500px width (accounting for left sidebar ~64-256px)
        const leftSidebarWidth = document.querySelector('aside')?.offsetWidth || 64;
        const maxAllowedWidth = window.innerWidth - leftSidebarWidth - 500;
        
        const clampedWidth = Math.min(Math.max(newWidth, 250), Math.min(800, maxAllowedWidth));
        setSidebarWidth(clampedWidth);
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    // Add event listeners to the whole document to keep dragging smooth
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Set a class to the body to prevent text selection and keep cursor as col-resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging]);

  // Listen for canvas block drag events to animate the canvas border efficiently
  useEffect(() => {
    const handleCanvasDrag = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDragging: boolean }>;
      const isDraggingBlock = customEvent.detail.isDragging;
      const container = document.getElementById('canvas-border-container');
      const stickyBorder = document.getElementById('canvas-top-sticky-border');
      
      if (container && stickyBorder) {
        if (isDraggingBlock) {
          // Top sticky border gets top/left/right SOLID borders and accent background
          stickyBorder.className = "w-full border-t border-l border-r rounded-t-2xl h-4 mt-2 bg-accent/5 transition-all duration-300";
          stickyBorder.style.borderColor = '#007acc';
          
          // Container gets left/right/bottom dashed borders and accent background
          container.className = "flex-1 w-full relative border-l border-r border-b rounded-b-2xl transition-all duration-300 shadow-sm bg-accent/5 border-dashed";
          container.style.borderColor = 'rgba(0, 122, 204, 0.3)';
        } else {
          // Revert to default states
          stickyBorder.className = "w-full border-t rounded-t-2xl h-4 mt-2 bg-background transition-all duration-300";
          stickyBorder.style.borderColor = '#007acc';
          container.className = "flex-1 w-full relative transition-all duration-300";
          container.style.borderColor = ''; // reset container border color
        }
      }
    };

    window.addEventListener('canvas-drag-state', handleCanvasDrag);
    return () => window.removeEventListener('canvas-drag-state', handleCanvasDrag);
  }, []);

  // Derive revision info from real data
  const nextPendingRevision = useMemo(() => {
    return topic.revisions
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0] ?? null;
  }, [topic.revisions]);

  const revisionDay = nextPendingRevision?.cycleNumber ?? (topic.revisions.length > 0 ? topic.revisions[topic.revisions.length - 1].cycleNumber : 1);

  // Format date for context links display and buttons
  const formatDate = (d: Date | string) => {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const nextDueText = useMemo(() => {
    if (!nextPendingRevision) return 'Completed';
    const due = new Date(nextPendingRevision.scheduledFor);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueMidnight = new Date(due);
    dueMidnight.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueMidnight.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return formatDate(due);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return formatDate(due);
  }, [nextPendingRevision]);

  const [isPending, startTransition] = useTransition();

  // Spaced Repetition Engine Logic
  const { revisionButtonState, revisionButtonText, handleRevisionAction } = useMemo(() => {
    if (topic.revisions.length === 0) {
      return {
        revisionButtonState: 'start' as const,
        revisionButtonText: 'Start Revisions',
        handleRevisionAction: () => {
          startTransition(async () => {
            await startTopicRevisions(topic.id);
          });
        }
      };
    }

    if (!nextPendingRevision) {
      return {
        revisionButtonState: 'completed' as const,
        revisionButtonText: 'Completed',
        handleRevisionAction: () => {}
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(nextPendingRevision.scheduledFor);
    scheduled.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((scheduled.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 2) {
      return {
        revisionButtonState: 'wait' as const,
        revisionButtonText: `Next Revision: ${formatDate(scheduled)}`,
        handleRevisionAction: () => {}
      };
    }

    if (diffDays === 1) {
      return {
        revisionButtonState: 'early' as const,
        revisionButtonText: 'Revise Early',
        handleRevisionAction: () => {
          startTransition(async () => {
            await completeRevision(nextPendingRevision.id);
          });
        }
      };
    }

    return {
      revisionButtonState: 'due' as const,
      revisionButtonText: 'Mark as Revised',
      handleRevisionAction: () => {
        startTransition(async () => {
          await completeRevision(nextPendingRevision.id);
        });
      }
    };
  }, [topic.revisions.length, topic.id, nextPendingRevision]);

  // Serialize canvas data for the canvas component
  const initialCanvasContent = useMemo(() => {
    if (!topic.canvasData) return '';
    if (typeof topic.canvasData === 'string') return topic.canvasData;
    return JSON.stringify(topic.canvasData);
  }, [topic.canvasData]);

  // Derive context links from real mention data
  const contextLinks = useMemo(() => ({
    outbound: topic.mentionsOut.map(m => ({
      id: m.targetTopic.id,
      path: m.targetTopic.title,
      taggedAt: formatDate(m.createdAt),
      updatedAt: formatDate(m.targetTopic.updatedAt),
    })),
    inbound: topic.mentionsIn.map(m => ({
      id: m.sourceTopic.id,
      path: m.sourceTopic.title,
      taggedAt: formatDate(m.createdAt),
      updatedAt: formatDate(m.sourceTopic.updatedAt),
    })),
  }), [topic.mentionsOut, topic.mentionsIn]);

  // Derive quick notes from real data
  const quickNotes = useMemo(() => {
    return topic.quickNotes.map(note => ({
      id: note.id,
      type: (note.isSubjectLevel ? 'subject' : 'topic-same-subject') as 'subject' | 'topic-same-subject' | 'topic-diff-subject',
      content: note.content,
      date: timeAgo(note.createdAt),
      linkedItemTitle: note.isSubjectLevel ? topic.subject.name : topic.title,
    }));
  }, [topic.quickNotes, topic.subject.name, topic.title]);

  const handleMentionClick = (clickedTopicId: string) => {
    setPreviewTopicId(clickedTopicId);
    setActiveTab('resources');
    setIsSidebarOpen(true);
    setSidebarWidth(window.innerWidth / 2);
  };

  const fullFadeWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 960;
  const overlayOpacity = isSidebarOpen
    ? Math.min(0.6, Math.max(0, (sidebarWidth - 384) / Math.max(1, fullFadeWidth - 384) * 0.6))
    : 0;

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      {/* Main Content Area */}
      <div 
        className={`flex-1 h-full overflow-y-auto overflow-x-hidden flex flex-col min-w-[500px] relative ${isDragging ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ marginRight: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        onScroll={handleScroll}
      >
        {/* Floating Sidebar Toggle Button */}
        {!isSidebarOpen && (
          <button 
            onClick={() => {
              setIsSidebarOpen(true);
              setSidebarWidth(window.innerWidth / 4);
            }}
            className="fixed top-6 right-6 p-2 bg-background border border-border shadow-sm hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all z-50 animate-in fade-in zoom-in-95"
            title="Open Context Panel"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        
        {/* Dynamic Dark Overlay */}
        {overlayOpacity > 0 && (
          <div 
            className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-75 z-50"
            style={{ opacity: overlayOpacity }}
          />
        )}
        
        <div 
          className="max-w-[960px] min-w-[960px] mx-auto w-full h-full flex flex-col px-8 transition-all duration-300 ease-in-out"
        >
          <div className="pt-5 flex-shrink-0 bg-background z-30">
            {/* Top Utility Row */}
            <div className="flex items-center justify-between">
              <Link 
                href={`/subject/${topic.subject.id}`} 
                className={`inline-flex p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all duration-300 -ml-1.5 ${!isScrolled ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors max-w-[150px]">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="truncate">React Hooks</span>
                </button>
                <div className="w-px h-3 bg-border/50 mx-1" />
                <button 
                  onClick={async () => {
                    setIsCreatingTopic(true);
                    try {
                      const newTopic = await createTopic(topic.subject.id, "Untitled Topic");
                      router.push(`/topic/${newTopic.id}`);
                    } catch (e) {
                      console.error(e);
                      setIsCreatingTopic(false);
                    }
                  }}
                  disabled={isCreatingTopic}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/10 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {isCreatingTopic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  New Topic
                </button>
              </div>
            </div>
          </div>

          <div className={`flex-shrink-0 sticky top-0 bg-background z-40 transition-all duration-300 ${isScrolled ? 'pt-11' : 'pt-8'}`}>
            <div className="flex flex-col pb-2">
              {/* Title & Metadata Row */}
              <div className="flex flex-col relative">
                {/* Absolutely positioned Tags Area - hovers in the gap above without shifting layout */}
                <div className="absolute -top-[26px] left-0 flex items-center gap-2 text-[#a0a0a0] text-xs font-medium z-10">
                  {tags.length === 0 && !isAddingTag && (
                    <span 
                      onClick={() => setIsAddingTag(true)}
                      className="px-2 py-1 border border-dashed border-white/10 rounded-md text-[#888888]/60 hover:text-foreground hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      Add tags...
                    </span>
                  )}
                  {tags.map((tag) => (
                    <button 
                      key={tag.id} 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newTags = tags.filter(t => t.id !== tag.id);
                        setTags(newTags);
                        await updateTopic(topic.id, { tags: newTags.map(t => t.name) });
                      }}
                      className="group relative flex items-center justify-center px-2 py-1 bg-white/5 border border-white/5 rounded-md hover:bg-white/10 hover:border-white/20 text-[#a0a0a0] hover:text-foreground transition-colors overflow-hidden"
                      title="Click to remove tag"
                    >
                      <span className="group-hover:opacity-30 transition-opacity duration-300">{tag.name}</span>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <X className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                  
                  {isAddingTag ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (newTagText.trim() && suggestedTags.length === 0) {
                              handleCommitTag(newTagText);
                            } else {
                              setIsAddingTag(false);
                              setNewTagText('');
                            }
                          }, 150);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (newTagText.trim()) handleCommitTag(newTagText);
                          } else if (e.key === 'Escape') {
                            setNewTagText('');
                            setIsAddingTag(false);
                          }
                        }}
                        autoFocus
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded-md outline-none text-foreground w-32 placeholder:text-[#888888]/50"
                        placeholder="tag..."
                      />
                      {suggestedTags.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl overflow-hidden z-50">
                          {suggestedTags.map(st => (
                            <div 
                              key={st.id} 
                              className="px-3 py-2 text-sm text-[#a0a0a0] hover:bg-white/5 hover:text-foreground cursor-pointer"
                              onMouseDown={(e) => {
                                e.preventDefault(); // prevent input blur
                                handleCommitTag(st.name);
                              }}
                            >
                              {st.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsAddingTag(true)}
                      className="flex items-center justify-center w-[25px] h-[25px] rounded-md border border-[#888888]/50 hover:bg-white/10 text-[#888888] hover:text-foreground transition-colors" 
                      title="Add tag"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#888888]/50 hover:text-foreground" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap justify-between items-start gap-4 relative">
                  {/* Scroll-revealed Back Button */}
                  <Link 
                    href={`/subject/${topic.subject.id}`} 
                    className={`absolute -left-10 top-[5px] p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all duration-300 z-20 ${isScrolled ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
                    title="Go back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>

                  <h1 
                    ref={titleInputRef}
                    contentEditable={isEditingTitle}
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={initialTitleHtml.current}
                    onDoubleClick={(e) => {
                      setIsEditingTitle(true);
                      setTimeout(() => {
                        const el = titleInputRef.current;
                        if (!el) return;
                        el.focus();
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(el);
                        range.collapse(false); // Move cursor to the end
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      }, 0);
                    }}
                    onBlur={(e) => {
                      setIsEditingTitle(false);
                      const newTitle = e.currentTarget.textContent || '';
                      if (!newTitle.trim()) {
                        e.currentTarget.textContent = 'Untitled Topic';
                        setTitle('Untitled Topic');
                        updateTopicTitle(topic.subjectId, topic.id, 'Untitled Topic');
                      }
                    }}
                    onInput={(e) => {
                      const newTitle = e.currentTarget.textContent || '';
                      setTitle(newTitle);
                      updateTopicTitle(topic.subjectId, topic.id, newTitle);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className={`outline-none ${isEditingTitle ? 'cursor-text ring-0' : 'cursor-pointer'} ${canvasContainerWidth < 650 ? 'text-2xl' : 'text-3xl'} font-bold text-foreground transition-all duration-300 leading-snug`}
                  />
                  
                  {/* Full View: Button on Title Row */}
                  {canvasContainerWidth >= 650 && (
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                      <div className={`transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Saving to local storage" />
                      </div>
                      <button 
                        onClick={handleRevisionAction}
                        disabled={isPending || revisionButtonState === 'completed' || revisionButtonState === 'wait'}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300
                          ${revisionButtonState === 'start' ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 shadow-sm cursor-pointer' : 
                            revisionButtonState === 'due' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer' : 
                            revisionButtonState === 'early' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 shadow-sm cursor-pointer' : 
                            revisionButtonState === 'completed' ? 'bg-white/5 text-[#888888] opacity-50 cursor-not-allowed border border-white/5' :
                            'bg-white/5 text-[#888888] cursor-pointer border border-white/10 shadow-sm'}`}
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                         revisionButtonState === 'start' ? <PlayCircle className="w-3.5 h-3.5" /> : 
                         revisionButtonState === 'wait' ? <Calendar className="w-3.5 h-3.5" /> :
                         <CheckCircle2 className="w-3.5 h-3.5" />}
                        {revisionButtonText}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className={`flex flex-wrap ${canvasContainerWidth < 650 ? 'justify-between' : ''} items-center gap-4 text-[13px] relative`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1 text-[#888888] text-[11px] pl-1 opacity-70 font-medium">
                      {new Date(topic.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {/* Narrow View Info & Settings Buttons */}
                    {canvasContainerWidth < 650 && (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setIsSettingsModalOpen(true)}
                          className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Actions
                        </button>
                        <button 
                          onClick={() => setIsInfoModalOpen(true)}
                          className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all"
                        >
                          <Info className="w-3.5 h-3.5" />
                          Info
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Desktop View Info & Settings Buttons (Absolute right to prevent any layout shift) */}
                  {canvasContainerWidth >= 650 && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-4">
                      <button 
                        onClick={() => setIsInfoModalOpen(true)}
                        className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all"
                      >
                        <Info className="w-3.5 h-3.5" />
                        Info
                      </button>
                      <button 
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Actions
                      </button>
                      
                    </div>
                  )}

                  {/* Narrow View: Button on Metadata Row */}
                  {canvasContainerWidth < 650 && (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Saving to local storage" />
                      </div>
                      <button 
                        onClick={handleRevisionAction}
                        disabled={isPending || revisionButtonState === 'completed' || revisionButtonState === 'wait'}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300
                          ${revisionButtonState === 'start' ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 shadow-sm cursor-pointer' : 
                            revisionButtonState === 'due' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer' : 
                            revisionButtonState === 'early' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 shadow-sm cursor-pointer' : 
                            revisionButtonState === 'completed' ? 'bg-white/5 text-[#888888] opacity-50 cursor-not-allowed border border-white/5' :
                            'bg-white/5 text-[#888888] border-white/10 shadow-sm cursor-pointer'}`}
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                         revisionButtonState === 'start' ? <PlayCircle className="w-3.5 h-3.5" /> : 
                         revisionButtonState === 'wait' ? <Calendar className="w-3.5 h-3.5" /> :
                         <CheckCircle2 className="w-3.5 h-3.5" />}
                        {revisionButtonText}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
            
            {/* Sticky Curved Border */}
            <div id="canvas-top-sticky-border" className="w-full border-t rounded-t-2xl h-4 mt-2 bg-background" style={{ borderColor: '#007acc' }} />
          </div>
        
          {/* Topic Canvas */}
          <div 
            id="canvas-border-container" 
            className="flex-1 w-full relative transition-all duration-300"
          >
            <div ref={canvasWrapperRef} className="pb-32 w-full h-full relative ">
              <TopicCanvas 
                topicId={topic.id} 
                initialContent={initialCanvasContent} 
                onMentionClick={handleMentionClick} 
                containerWidth={canvasContainerWidth} 
                onSavingChange={setIsSaving}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Context Panel) */}
      {/* Drag Handle */}
      {isSidebarOpen && (
        <div 
          className="fixed top-0 bottom-0 cursor-col-resize hover:bg-primary/50 transition-colors z-[60]"
          style={{ right: `${sidebarWidth}px`, width: '4px', backgroundColor: isDragging ? 'hsl(var(--primary) / 0.5)' : 'transparent' }}
          onMouseDown={() => setIsDragging(true)}
        />
      )}
      
      <div 
        className={`fixed right-0 top-0 bottom-0 bg-sidebar flex flex-col h-full shadow-2xl z-50 overflow-hidden ${isDragging ? '' : 'transition-all duration-300 ease-in-out'} ${isSidebarOpen ? 'border-l border-divider' : 'border-none'}`}
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
      >
        <div style={{ width: `${sidebarWidth}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Sidebar Header & Tabs */}
          <div className="flex flex-col border-b border-divider">
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <h2 className="font-semibold text-foreground text-[15px]">
                Context Panel
              </h2>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Close Panel"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          
            <div className="flex px-6 space-x-6">
              <button 
                onClick={() => setActiveTab('links')}
                className={`pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'links' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                Links
                {activeTab === 'links' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
              <button 
                onClick={() => setActiveTab('notes')}
                className={`pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'notes' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                Notes
                {activeTab === 'notes' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
              <button 
                onClick={() => setActiveTab('resources')}
                className={`pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'resources' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                Resources
                {activeTab === 'resources' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 pb-20">
            {activeTab === 'links' && <TopicLinksTimeline contextLinks={contextLinks} onMentionClick={handleMentionClick} />}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Notes
                  </h3>
                  <button className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded font-medium transition-colors">
                    + New Note
                  </button>
                </div>
                
                {quickNotes.map(note => (
                  <div key={note.id} className="p-3 rounded-lg border border-divider bg-background hover:border-accent/50 transition-colors group cursor-pointer" onClick={() => handleMentionClick(note.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${note.type === 'topic-same-subject' ? 'bg-blue-500/10 text-blue-500' : note.type === 'topic-diff-subject' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {note.type === 'topic-same-subject' ? 'Direct Note' : note.type === 'topic-diff-subject' ? 'Cross-Subject Note' : 'Subject-Level Note'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{note.date}</span>
                    </div>
                    <div className="text-sm text-foreground mb-3 leading-relaxed">{note.content}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/5 p-1.5 rounded border border-divider/50">
                      <LinkIcon className="w-3 h-3" />
                      <span className="truncate">Linked to: <span className="font-medium text-foreground/80">{note.linkedItemTitle}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic text-center px-4">
                Resources section coming soon...
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Info Modal */}
      <TopicHistoryModal 
        isOpen={isInfoModalOpen} 
        onClose={() => setIsInfoModalOpen(false)} 
        topic={topic} 
      />
      {/* Settings Modal */}
      <TopicSettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
        topicId={topic.id}
      />
    </div>
  );
}
