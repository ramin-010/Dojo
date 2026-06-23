// src/app/topic/[id]/TopicWorkspace.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  Plus,
  Menu,
  Loader2,
  Info,
  Settings,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopicCanvas } from '@/components/canvas/TopicCanvas';
import { timeAgo } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { createTopic, deleteResourcePermanently, getTopicResources, createTextResourceLink, renameResource, deleteMultipleResourcesPermanently, deleteTopicMention } from '@/app/actions';
import { TopicHistoryModal } from './TopicHistoryModal';
import { TopicSettingsModal } from './TopicSettingsModal';
import { toast } from 'sonner';

// ── Local pieces ───────────────────────────────────────────────────────────────
import { TopicWorkspaceProps, SidebarTab } from './types';
import { useTopicRevisions, formatDate } from './hooks/useTopicRevisions';
import { useTopicTitle } from './hooks/useTopicTitle';
import { useTopicTags } from './hooks/useTopicTags';
import { useSidebarResize } from './hooks/useSidebarResize';
import { TagsBar } from './components/TagsBar';
import { RevisionButton } from './components/RevisionButton';
import { ContextSidebar } from './components/ContextSidebar';

export type { SidebarTab };

export function TopicWorkspace({ topic, allSubjectTags, adjacentTopics, noteCategories }: TopicWorkspaceProps) {
  // ── Sidebar open / tab state ───────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('links');
  const [previewTopicId, setPreviewTopicId] = useState<string | null>(null);
  const [activeUrls, setActiveUrls] = useState<string[]>([]);
  const [localResources, setLocalResources] = useState<any[]>(topic.resources || []);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // ── Topic creation ─────────────────────────────────────────────────────────
  const router = useRouter();
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  // ── Scroll-reveal state ────────────────────────────────────────────────────
  const [isScrolled, setIsScrolled] = useState(false);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 40);
  };

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { sidebarWidth, setSidebarWidth, isDragging, setIsDragging } =
    useSidebarResize(384);

  const {
    title: _title, // consumed only via setTitle / saving side-effect
    setTitle,
    isEditingTitle,
    setIsEditingTitle,
    titleInputRef,
    initialTitleHtml,
  } = useTopicTitle({
    topicId: topic.id,
    subjectId: topic.subjectId,
    initialTitle: topic.title,
  });

  const {
    tags,
    isAddingTag,
    setIsAddingTag,
    newTagText,
    setNewTagText,
    suggestedTags,
    handleCommitTag,
    handleRemoveTag,
  } = useTopicTags({
    topicId: topic.id,
    initialTags: topic.tags,
    allSubjectTags,
  });

  const {
    revisionButtonState,
    revisionButtonText,
    handleRevisionAction,
    isPending,
  } = useTopicRevisions({
    topicId: topic.id,
    revisions: topic.revisions,
  });

  // ── isSaving indicator (from store, passed to canvas) ─────────────────────
  const { isSaving, setIsSaving } = useAppStore();

  // ── Canvas container width (RAF-throttled ResizeObserver) ─────────────────
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(900);
  const resizeRafRef = useRef<number>(0);

  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width;
          setCanvasContainerWidth(prev => {
            if (Math.abs(newWidth - prev) > 10) return newWidth;
            return prev;
          });
        }
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  // ── Canvas drag-border animation (DOM mutation, intentionally imperative) ──
  useEffect(() => {
    const handleCanvasDrag = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDragging: boolean }>;
      const isDraggingBlock = customEvent.detail.isDragging;
      const container = document.getElementById('canvas-border-container');
      const stickyBorder = document.getElementById('canvas-top-sticky-border');

      if (container && stickyBorder) {
        if (isDraggingBlock) {
          stickyBorder.className =
            'w-full border-t border-l border-r rounded-t-2xl h-4 mt-2 bg-accent/5 transition-all duration-300';
          stickyBorder.style.borderColor = '#007acc';
          container.className =
            'flex-1 w-full relative border-l border-r border-b rounded-b-2xl transition-all duration-300 shadow-sm bg-accent/5 border-dashed';
          container.style.borderColor = 'rgba(0, 122, 204, 0.3)';
        } else {
          stickyBorder.className =
            'w-full border-t rounded-t-2xl h-4 mt-2 bg-background transition-all duration-300';
          stickyBorder.style.borderColor = '#007acc';
          container.className =
            'flex-1 w-full relative transition-all duration-300';
          container.style.borderColor = '';
        }
      }
    };

    window.addEventListener('canvas-drag-state', handleCanvasDrag);
    return () => window.removeEventListener('canvas-drag-state', handleCanvasDrag);
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const initialCanvasContent = useMemo(() => {
    if (!topic.canvasData) return '';
    if (typeof topic.canvasData === 'string') return topic.canvasData;
    return JSON.stringify(topic.canvasData);
  }, [topic.canvasData]);

  const contextLinks = useMemo(
    () => ({
      outbound: topic.mentionsOut.map((m) => ({
        id: m.id,
        topicId: m.targetTopic.id,
        path: m.targetTopic.subjectId !== topic.subjectId 
          ? `${m.targetTopic.subject?.name || 'Other Subject'} / ${m.targetTopic.title}` 
          : m.targetTopic.title,
        taggedAt: formatDate(m.createdAt),
        updatedAt: formatDate(m.targetTopic.updatedAt),
      })),
      inbound: topic.mentionsIn.map((m) => ({
        id: m.id,
        topicId: m.sourceTopic.id,
        path: m.sourceTopic.subjectId !== topic.subjectId 
          ? `${m.sourceTopic.subject?.name || 'Other Subject'} / ${m.sourceTopic.title}` 
          : m.sourceTopic.title,
        taggedAt: formatDate(m.createdAt),
        updatedAt: formatDate(m.sourceTopic.updatedAt),
      })),
    }),
    [topic.mentionsOut, topic.mentionsIn],
  );

  const quickNotes = useMemo(
    () =>
      topic.quickNotes.map((note) => ({
        id: note.id,
        type: (note.topicId === null
          ? 'subject'
          : 'topic-same-subject') as
          | 'subject'
          | 'topic-same-subject'
          | 'topic-diff-subject',
        content: note.content,
        date: timeAgo(note.createdAt),
        linkedItemTitle: note.topicId === null
          ? topic.subject.name
          : topic.title,
      })),
    [topic.quickNotes, topic.subject.name, topic.title],
  );

  // ── Mention click → open sidebar ───────────────────────────────────────────
  const handleMentionClick = (clickedTopicId: string) => {
    setPreviewTopicId(clickedTopicId);
    setActiveTab('resources');
    setIsSidebarOpen(true);
    setSidebarWidth(window.innerWidth / 2);
  };

  const handleDeleteMention = useCallback(async (mentionId: string, isOutbound: boolean) => {
    const toastId = `del-mention-${mentionId}`;
    toast.loading('Unlinking topic...', { id: toastId });
    try {
      await deleteTopicMention(mentionId);
      toast.success('Link removed', { id: toastId });
      router.refresh();
    } catch (e) {
      toast.error('Failed to remove link', { id: toastId });
    }
  }, []);

  const handleBlockRemoved = useCallback((block: any) => {
    if (!block.url) return;
    
    const toastId = `del-${block.url}`;

    const renderToast = (isDeleting: boolean) => {
      toast('Removed from canvas', {
        id: toastId,
        duration: isDeleting ? 100000 : 5000,
        action: {
          label: isDeleting ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Deleting...</span>
            </div>
          ) : (
            'Delete Permanently'
          ),
          onClick: async (e) => {
            e.preventDefault();
            if (isDeleting) return;

            renderToast(true);

            try {
              toast.dismiss(toastId);
              const delToastId = toast.loading('Deleting permanently...');
              await deleteResourcePermanently(block.url);
              setLocalResources(prev => prev.filter(r => r.url !== block.url));
              toast.success('Resource permanently deleted', { id: delToastId });
            } catch (err) {
              console.error('Failed to permanently delete resource:', err);
              toast.error('Failed to delete resource');
            }
          }
        }
      });
    };

    renderToast(false);
  }, []);

  const handleResourceAdded = useCallback(async (data: any) => {
    if (!data) return;
    
    // Phase 1: DB object passed from cloud upload
    if (data.id) {
      setLocalResources(prev => [data, ...prev]);
      return;
    }

    // Phase 2: { text, type } passed from Tiptap SavedResourceExtension
    if (data.text && data.type) {
       try {
         const result = await createTextResourceLink(topic.id, data.text, data.type);
         if (result.type === 'resource') {
            setLocalResources(prev => [result.data, ...prev]);
            toast.success('Resource saved');
         } else {
            toast.success('Resource saved');
         }
       } catch (err) {
         console.error('Failed to save text resource:', err);
         toast.error('Failed to save resource');
       }
    }
  }, [topic.id]);

  const handleResourceDelete = useCallback(async (id: string, url: string) => {
    const toastId = `del-sidebar-${id}`;
    toast('Delete this resource?', {
      id: toastId,
      duration: 5000,
      action: {
        label: 'Confirm Delete',
        onClick: async (e) => {
          e.preventDefault();
          toast.dismiss(toastId); // Dismiss the confirmation toast immediately
          const delToastId = toast.loading('Deleting...');
          try {
            await deleteResourcePermanently(id); // ID is safe and specific
            setLocalResources(prev => prev.filter(r => r.id !== id));
            toast.success('Resource deleted permanently', { id: delToastId });
          } catch (err) {
            console.error('Delete error', err);
            toast.error('Failed to delete', { id: delToastId });
          }
        }
      }
    });
  }, []);

  const handleMultipleResourceDelete = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const toastId = `del-multi-${ids.length}`;
    toast(`Delete all ${ids.length} resources?`, {
      id: toastId,
      duration: 5000,
      action: {
        label: 'Confirm Delete All',
        onClick: async (e) => {
          e.preventDefault();
          toast.dismiss(toastId);
          const delToastId = toast.loading(`Deleting ${ids.length} resources...`);
          try {
            await deleteMultipleResourcesPermanently(ids);
            setLocalResources(prev => prev.filter(r => !ids.includes(r.id)));
            toast.success('Resources deleted permanently', { id: delToastId });
          } catch (err) {
            console.error('Delete error', err);
            toast.error('Failed to delete resources', { id: delToastId });
          }
        }
      }
    });
  }, []);

  const handleResourceRename = useCallback(async (id: string, newTitle: string) => {
    // Optimistic update
    const prevResources = [...localResources];
    setLocalResources(prev => prev.map(r => r.id === id ? { ...r, title: newTitle } : r));
    try {
      await renameResource(id, newTitle);
    } catch (e) {
      console.error('Rename error', e);
      toast.error('Failed to rename resource');
      setLocalResources(prevResources);
    }
  }, [localResources]);

  // Fetch fresh resources if we switch to the resources tab
  useEffect(() => {
    if (activeTab === 'resources') {
      let isMounted = true;
      const fetchResources = async () => {
        try {
          const fresh = await getTopicResources(topic.id);
          if (isMounted) setLocalResources(fresh);
        } catch (e) {
          console.error("Failed to fetch fresh resources", e);
        }
      };
      
      const timer = setTimeout(fetchResources, 300);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [activeTab, topic.id]);

  // ── Overlay opacity (darkens main when sidebar is very wide) ──────────────
  // Overlay opacity and sidebar width are now driven purely by CSS variables during drag
  // to prevent React re-rendering the entire workspace at 60fps.

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <div
        className={`flex-1 h-full overflow-y-auto overflow-x-hidden min-w-[500px] relative ${
          isDragging ? '' : 'transition-all duration-300 ease-in-out'
        }`}
        style={{ marginRight: isSidebarOpen ? 'var(--sidebar-width, 384px)' : '0px' }}
        onScroll={handleScroll}
      >
        {/* Floating Sidebar Toggle */}
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

        {/* Dark Overlay */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-75 z-50"
            style={{ opacity: 'var(--sidebar-overlay-opacity, 0)' }}
          />
        )}

        <div className="max-w-[960px] min-w-[960px] mx-auto w-full min-h-full px-8 transition-all duration-300 ease-in-out">
          {/* ── Top Utility Row ─────────────────────────────────────────── */}
          <div className="pt-5 flex-shrink-0 bg-background z-30">
            <div className="flex items-center justify-between">
              <Link
                href={`/subject/${topic.subject.id}`}
                className={`inline-flex p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all duration-300 -ml-1.5 ${
                  !isScrolled
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2 pointer-events-none'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>

              <div className="flex items-center gap-1 ">
                {/* Previous Topic Button */}
                {adjacentTopics?.prev ? (
                  <button 
                    onClick={() => router.push(`/topic/${adjacentTopics.prev?.id}`)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-white/1 hover:text-foreground hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors max-w-[150px]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 " />
                    <span className="truncate text-[13.5px] text-[#ffffff]/60 hover:text-[#ffffff]/80">{adjacentTopics.prev.title}</span>
                  </button>
                ) : (
                  <button className="flex items-center gap-1 text-[8px] font-medium text-muted-foreground px-2.5 py-1 rounded-md max-w-[150px] opacity-40">
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="truncate text-[13.5px]">First Topic</span>
                  </button>
                )}

                <div className="w-px h-3 bg-border/50 " />

                {/* Next Topic Button */}
                {adjacentTopics?.next ? (
                  <button 
                    onClick={() => router.push(`/topic/${adjacentTopics.next?.id}`)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-white/1 hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors max-w-[150px]"
                  >
                    <span className="truncate text-[13.5px] text-[#ffffff]/60 hover:text-[#ffffff]/80">{adjacentTopics.next.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 " />
                  </button>
                ) : (
                  <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground px-2.5 py-1 rounded-md max-w-[150px] opacity-40">
                    <span className="truncate text-[13.5px]">Last Topic</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                  <div className=" bg-border/50 " />
                <button
                  onClick={async () => {
                    setIsCreatingTopic(true);
                    try {
                      const newTopic = await createTopic(
                        topic.subject.id,
                        'Untitled Topic',
                      );
                      router.push(`/topic/${newTopic.id}`);
                    } catch (e) {
                      console.error(e);
                      setIsCreatingTopic(false);
                    }
                  }}
                  disabled={isCreatingTopic}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/10 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {isCreatingTopic ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  New Topic
                </button>
              </div>
            </div>
          </div>

          {/* ── Sticky Header (Title + Tags + Metadata) ─────────────────── */}
          <div
            className={`flex-shrink-0 sticky top-0 bg-background z-40 transition-all duration-300 ${
              isScrolled ? 'pt-11' : 'pt-8'
            }`}
          >
            <div className="flex flex-col pb-2">
              <div className="flex flex-col relative">
                {/* Tags Bar */}
                <TagsBar
                  tags={tags}
                  isAddingTag={isAddingTag}
                  setIsAddingTag={setIsAddingTag}
                  newTagText={newTagText}
                  setNewTagText={setNewTagText}
                  suggestedTags={suggestedTags}
                  onCommitTag={handleCommitTag}
                  onRemoveTag={handleRemoveTag}
                />

                {/* Title Row */}
                <div className="flex flex-wrap justify-between items-start gap-4 relative">
                  {/* Scroll-revealed back button */}
                  <Link
                    href={`/subject/${topic.subject.id}`}
                    className={`absolute -left-10 top-[5px] p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all duration-300 z-20 ${
                      isScrolled
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 -translate-x-2 pointer-events-none'
                    }`}
                    title="Go back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>

                  <h1
                    ref={titleInputRef}
                    contentEditable={isEditingTitle}
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={initialTitleHtml.current}
                    onDoubleClick={() => {
                      setIsEditingTitle(true);
                      setTimeout(() => {
                        const el = titleInputRef.current;
                        if (!el) return;
                        el.focus();
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(el);
                        range.collapse(false);
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
                      }
                    }}
                    onInput={(e) => {
                      setTitle(e.currentTarget.textContent || '');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className={`outline-none ${
                      isEditingTitle ? 'cursor-text ring-0' : 'cursor-pointer'
                    } ${
                      canvasContainerWidth < 650 ? 'text-2xl' : 'text-3xl'
                    } font-bold text-foreground transition-all duration-300 leading-snug`}
                  />

                  {/* Wide layout: revision button beside title */}
                  {canvasContainerWidth >= 650 && (
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                      <div
                        className={`transition-opacity duration-500 ${
                          isSaving ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <span
                          className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"
                          title="Saving to local storage"
                        />
                      </div>
                      <RevisionButton
                        state={revisionButtonState}
                        text={revisionButtonText}
                        isPending={isPending}
                        onClick={handleRevisionAction}
                      />
                    </div>
                  )}
                </div>

                {/* Metadata Row */}
                <div
                  className={`flex flex-wrap ${
                    canvasContainerWidth < 650 ? 'justify-between' : ''
                  } items-center gap-4 text-[13px] relative`}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1 text-[#888888] text-[11px] pl-1 opacity-70 font-medium">
                      {new Date(topic.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>

                    {/* Narrow: info + settings inline */}
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

                  {/* Wide: info + settings absolutely positioned right */}
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

                  {/* Narrow: revision button beside metadata */}
                  {canvasContainerWidth < 650 && (
                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className={`transition-opacity duration-500 ${
                          isSaving ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <span
                          className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"
                          title="Saving to local storage"
                        />
                      </div>
                      <RevisionButton
                        state={revisionButtonState}
                        text={revisionButtonText}
                        isPending={isPending}
                        onClick={handleRevisionAction}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Curved Border */}
            <div
              id="canvas-top-sticky-border"
              className="w-full border-t rounded-t-2xl h-4 mt-2 bg-background"
              style={{ borderColor: '#007acc' }}
            />
          </div>

          {/* ── Topic Canvas ─────────────────────────────────────────────── */}
          <div
            id="canvas-border-container"
            className="w-full relative transition-all duration-300"
          >
            <div ref={canvasWrapperRef} className="w-full min-h-full relative">
              <TopicCanvas
                topicId={topic.id}
                subjectId={topic.subject.id}
                initialContent={initialCanvasContent}
                onMentionClick={handleMentionClick}
                containerWidth={canvasContainerWidth}
                onSavingChange={setIsSaving}
                onActiveUrlsChange={setActiveUrls}
                onBlockRemoved={handleBlockRemoved}
                onResourceAdded={handleResourceAdded}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Context Sidebar ─────────────────────────────────────────────────── */}
      <ContextSidebar
        topicId={topic.id}
        subjectId={topic.subjectId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sidebarWidth={sidebarWidth}
        isDragging={isDragging}
        onDragHandleMouseDown={() => setIsDragging(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        contextLinks={contextLinks}
        quickNotes={topic.quickNotes || []}
        noteCategories={noteCategories || []}
        resources={localResources}
        activeUrls={activeUrls}
        onMentionClick={handleMentionClick}
        onDeleteResource={handleResourceDelete}
        onDeleteMultipleResources={handleMultipleResourceDelete}
        onRenameResource={handleResourceRename}
        onDeleteMention={handleDeleteMention}
      />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <TopicHistoryModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        topic={topic}
      />
      <TopicSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        topicId={topic.id}
      />
    </div>
  );
}