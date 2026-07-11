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
  Columns,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopicCanvas } from '@/components/canvas/TopicCanvas';
import { timeAgo } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { createTopic, deleteCapturePermanently, getTopicLinks, createTextCaptureLink, renameCapture, deleteMultipleCapturesPermanently, deleteTopicMention, saveCanvasData } from '@/app/actions';
import { TopicHistoryModal } from './TopicHistoryModal';
import { FloatingCommandBar } from '@/components/ui/FloatingCommandBar';
import { TopicSettingsModal } from './TopicSettingsModal';
import { toast } from 'sonner';
import { uploadToCloud } from '@/lib/utils/upload';
import { Bot } from 'lucide-react';
import { AiImportCropperModal } from '@/components/topic/AiImportCropperModal';
import { CanvasBlockData } from '@/components/canvas/core/types';

// ── Local pieces ───────────────────────────────────────────────────────────────
import { TopicWorkspaceProps, SidebarTab, SplitViewData } from './types';
import { useTopicRevisions, formatDate } from './hooks/useTopicRevisions';
import { useTopicTitle } from './hooks/useTopicTitle';
import { useTopicTags } from './hooks/useTopicTags';
import { useSidebarResize } from './hooks/useSidebarResize';
import { TagsBar } from './components/TagsBar';
import { RevisionButton } from './components/RevisionButton';
import { ContextSidebar } from './components/ContextSidebar';
import { SplitViewer } from './components/SplitViewer';
import { useSplitViewResize } from './hooks/useSplitViewResize';

export type { SidebarTab };

export function TopicWorkspace({ topic, allSubjectTags, adjacentTopics, noteCategories }: TopicWorkspaceProps) {
  // ── Split View State ───────────────────────────────────────────────────────
  const [splitViewData, setSplitViewData] = useState<SplitViewData | null>(null);
  const { isDraggingSplitView, setIsDraggingSplitView } = useSplitViewResize();
  const frozenCanvasWidthRef = useRef<number>(900);
  const [isDraggingSidebarItem, setIsDraggingSidebarItem] = useState(false);
  // ── Sidebar open / tab state ───────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('symlinks');
  const [previewTopicId, setPreviewTopicId] = useState<string | null>(null);
  const [activeUrls, setActiveUrls] = useState<string[]>([]);
  const [localResources, setLocalResources] = useState<any[]>(topic.captures?.filter(c => c.type === 'LINK') || []);

  useEffect(() => {
    setLocalResources(topic.captures?.filter(c => c.type === 'LINK') || []);
  }, [topic.captures]);

  useEffect(() => {
    const handleGlobalCapture = (e: Event) => {
      const customEvent = e as CustomEvent<{ capture: any }>;
      const { capture } = customEvent.detail;
      
      // If it's a LINK for this topic or subject, optimistically add it
      if (capture && capture.type === 'LINK' && (capture.topicId === topic.id || (!capture.topicId && capture.subjectId === topic.subjectId))) {
        setLocalResources(prev => [capture, ...prev]);
      }
    };
    
    window.addEventListener('GLOBAL_CAPTURE_CREATED', handleGlobalCapture);
    return () => window.removeEventListener('GLOBAL_CAPTURE_CREATED', handleGlobalCapture);
  }, [topic.id, topic.subjectId]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // ── Topic creation ─────────────────────────────────────────────────────────
  const router = useRouter();
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  // ── AI Import State ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAiImporting, setIsAiImporting] = useState(false);
  const [rawImagesForCrop, setRawImagesForCrop] = useState<File[] | null>(null);
  const [showAiCommandBar, setShowAiCommandBar] = useState(false);

  const handleAiImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    let files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 5) {
      toast.warning(`You selected ${files.length} images. Limiting to 5 for optimal AI processing.`, { id: 'ai-import' });
      files = files.slice(0, 5);
    }
    
    setRawImagesForCrop(files);
    e.target.value = ''; // Reset input so same files can be re-selected if canceled
  };

  const processAiCommand = async (croppedFiles: File[], userContext?: string, taggedBlocks?: CanvasBlockData[]) => {
    setRawImagesForCrop(null); // Close modal immediately if open
    setShowAiCommandBar(false); // Close command bar

    let combinedContext = userContext || '';
    if (taggedBlocks && taggedBlocks.length > 0) {
      const taggedContent = taggedBlocks.map(b => `--- Block ID: ${b.blockId} ---\n${b.content}\n--- End Block ---`).join('\n\n');
      combinedContext = `Here are some existing blocks for context:\n${taggedContent}\n\n${combinedContext}`;
    }

    if (croppedFiles.length === 0 && combinedContext.trim() === '') {
      toast.error('Please provide an image or some text context.', { id: 'ai-import' });
      return;
    }

    setIsAiImporting(true);

    const publicIdsToCleanup: string[] = [];
    const imageUrls: string[] = [];

    try {
      if (croppedFiles.length > 0) {
        toast.loading('Processing images through CV pipeline...', { id: 'ai-import' });
        // Helper function to chunk array
      const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      };

      // We process 2 images at a time to prevent overloading the Python CV proxy
      const chunks = chunkArray(croppedFiles, 2);

      // 1. Process via CV Pipeline & Upload to Cloudinary (Batched)
      for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        toast.loading(`Enhancing images batch ${c + 1}/${chunks.length}...`, { id: 'ai-import' });
        
        const uploadPromises = chunk.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('output_mode', 'cream');
          formData.append('denoise_strength', '10');
          if (topic.id) formData.append('topicId', topic.id);
          if (topic.subjectId) formData.append('subjectId', topic.subjectId);

          const cvRes = await fetch('/api/test-scan-cv', {
            method: 'POST',
            body: formData,
          });

          if (!cvRes.ok) {
            const errText = await cvRes.text();
            throw new Error(`CV Processing failed: ${errText}`);
          }
          return cvRes.json();
        });

        const results = await Promise.all(uploadPromises);
        results.forEach(res => {
          if (res.url) imageUrls.push(res.url);
          if (res.publicId) publicIdsToCleanup.push(res.publicId);
        });
      }

        if (imageUrls.length === 0) {
          throw new Error('No images were successfully processed.');
        }
      }

      // 2. Call Gemini
      toast.loading(croppedFiles.length > 0 ? 'AI is synthesizing your notes...' : 'AI is processing your context...', { id: 'ai-import' });
      const geminiRes = await fetch('/api/canvas/extract-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, userContext: combinedContext }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(errText || 'AI extraction failed');
      }
      const { blocks } = await geminiRes.json();

      // 3. Append to Canvas seamlessly via Event Bus
      if (blocks && blocks.length > 0) {
        blocks.forEach((newBlock: any) => {
          window.dispatchEvent(new CustomEvent('CANVAS_INSERT_AI_BLOCK', { detail: { block: newBlock } }));
        });
        toast.success('Notes successfully synthesized and appended!', { id: 'ai-import' });
      } else {
        throw new Error('No blocks returned from AI');
      }

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Import failed', { id: 'ai-import' });
      
      // Cleanup Cloudinary uploads if pipeline failed after uploading
      if (publicIdsToCleanup.length > 0) {
        toast.loading('Cleaning up failed upload data...', { id: 'ai-import' });
        fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicIds: publicIdsToCleanup })
        }).catch(e => console.error('Failed to cleanup cloudinary:', e))
        .finally(() => toast.error(error.message || 'Import failed', { id: 'ai-import' }));
      }
    } finally {
      setIsAiImporting(false);
    }
  };

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

  // ── isSaving & splitView indicator (from store, passed to canvas) ─────────────────────
  const isSaving = useAppStore(state => state.isSaving);
  const setIsSaving = useAppStore(state => state.setIsSaving);
  const setIsSplitViewActive = useAppStore(state => state.setIsSplitViewActive);
  const typography = useAppStore(state => state.typography);
  const layoutWidth = typography?.layoutWidth ?? 960;

  // ── Canvas container width (RAF-throttled ResizeObserver) ─────────────────
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(900);
  const resizeRafRef = useRef<number>(0);

  const isDraggingSplitViewRef = useRef(isDraggingSplitView);
  useEffect(() => {
    isDraggingSplitViewRef.current = isDraggingSplitView;
  }, [isDraggingSplitView]);

  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (isDraggingSplitViewRef.current) return; // FIX 2c: Skip state updates during split-view drag
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
            'w-full border-t rounded-t-2xl h-4 mt-2 bg-accent/5 transition-all duration-300';
          stickyBorder.style.boxShadow = 'inset 1px 0 0 rgba(0, 122, 204, 0.3), inset -1px 0 0 rgba(0, 122, 204, 0.3)';
          container.className =
            'flex-1 w-full relative transition-all duration-300 shadow-sm bg-accent/5';
          container.style.boxShadow = 'inset 1px 0 0 rgba(0, 122, 204, 0.3), inset -1px 0 0 rgba(0, 122, 204, 0.3), inset 0 -1px 0 rgba(0, 122, 204, 0.3)';
        } else {
          stickyBorder.className =
            'w-full border-t rounded-t-2xl h-4 mt-2 bg-background transition-all duration-300';
          stickyBorder.style.boxShadow = '';
          stickyBorder.style.borderColor = 'var(--border)';
          container.className =
            'flex-1 w-full relative transition-all duration-300';
          container.style.boxShadow = '';
        }
      }
    };

    window.addEventListener('canvas-drag-state', handleCanvasDrag);
    return () => window.removeEventListener('canvas-drag-state', handleCanvasDrag);
  }, []);

  // ── Canvas upload-border animation (DOM mutation) ──
  useEffect(() => {
    const handleCanvasUpload = (e: Event) => {
      const customEvent = e as CustomEvent<{ isUploading: boolean }>;
      const isUploading = customEvent.detail.isUploading;
      const container = document.getElementById('canvas-border-container');
      const stickyBorder = document.getElementById('canvas-top-sticky-border');

      if (container && stickyBorder) {
        if (isUploading) {
          stickyBorder.className =
            'w-full border-t rounded-t-2xl h-4 mt-2 bg-blue-500/5 transition-all duration-300';
          stickyBorder.style.borderColor = '#007acc';
          container.className =
            'flex-1 w-full relative transition-all duration-300 shadow-sm bg-blue-500/5 border-b border-x border-dashed rounded-b-2xl';
          container.style.borderColor = 'rgba(0, 122, 204, 0.4)';
        } else {
          stickyBorder.className =
            'w-full border-t rounded-t-2xl h-4 mt-2 bg-background transition-all duration-300';
          stickyBorder.style.borderColor = 'var(--border)';
          container.className =
            'flex-1 w-full relative transition-all duration-300';
          container.style.borderColor = 'transparent';
        }
      }
    };

    window.addEventListener('canvas-upload-state', handleCanvasUpload);
    return () => window.removeEventListener('canvas-upload-state', handleCanvasUpload);
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
      (topic.captures?.filter(c => c.type === 'NOTE') || []).map((note) => ({
        id: note.id,
        type: 'topic-same-subject' as
          | 'subject'
          | 'topic-same-subject'
          | 'topic-diff-subject',
        content: note.content,
        date: timeAgo(note.createdAt),
        linkedItemTitle: topic.title,
      })),
    [topic.captures, topic.title],
  );

  // ── Mention click → open sidebar ───────────────────────────────────────────
  const handleMentionClick = useCallback((clickedTopicId: string) => {
    setPreviewTopicId(clickedTopicId);
    setActiveTab('resources');
    setIsSidebarOpen(true);
    setSidebarWidth(window.innerWidth / 2);
  }, [setPreviewTopicId, setActiveTab, setIsSidebarOpen, setSidebarWidth]);

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
              await deleteCapturePermanently(block.url);
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
         const result = await createTextCaptureLink(topic.id, data.text, data.type);
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
            await deleteCapturePermanently(id); // ID is safe and specific
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
            await deleteMultipleCapturesPermanently(ids);
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
      await renameCapture(id, newTitle);
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
          const fresh = await getTopicLinks(topic.id);
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

  const handleOpenSplitView = useCallback((data: SplitViewData) => {
    // Freeze canvas width BEFORE split view opens so autoZoom stays at 1
    frozenCanvasWidthRef.current = canvasContainerWidth;
    setSplitViewData(data);
    setIsSidebarOpen(false);
    setIsSplitViewActive(true);
  }, [setIsSplitViewActive, canvasContainerWidth]);

  const handleCloseSplitView = useCallback(() => {
    setSplitViewData(null);
    setIsSplitViewActive(false);
  }, [setIsSplitViewActive]);

  // Global event listener for opening split view from inside canvas blocks
  useEffect(() => {
    const handleCanvasOpenSplitView = (e: Event) => {
      const customEvent = e as CustomEvent<SplitViewData>;
      if (customEvent.detail) {
        handleOpenSplitView(customEvent.detail);
      }
    };
    
    window.addEventListener('CANVAS_OPEN_SPLIT_VIEW', handleCanvasOpenSplitView);
    return () => window.removeEventListener('CANVAS_OPEN_SPLIT_VIEW', handleCanvasOpenSplitView);
  }, [handleOpenSplitView]);

  const handleDragStartSidebarItem = useCallback((data: SplitViewData | null) => {
    setIsDraggingSidebarItem(data !== null);
  }, []);

  const handleDropSplitView = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSidebarItem(false);
    
    try {
      const payload = e.dataTransfer.getData('application/json');
      if (payload) {
        const data = JSON.parse(payload) as SplitViewData;
        if (data.type) {
          handleOpenSplitView(data);
        }
      }
    } catch (err) {
      console.error('Failed to parse split view drop data', err);
    }
  }, [handleOpenSplitView]);

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-background flex overflow-hidden relative">
      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <div
        className={`h-full relative ${
          isDragging || isDraggingSplitView ? '' : 'transition-all duration-300 ease-in-out'
        } ${splitViewData ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}
        style={{ 
          marginRight: isSidebarOpen && !splitViewData ? 'var(--sidebar-width, 384px)' : '0px',
          width: splitViewData ? 'calc(100% - var(--split-view-width, 35vw) - 3px)' : 'auto',
          flex: splitViewData ? 'none' : 1,
          minWidth: splitViewData ? 0 : '400px',
        }}
        onScroll={!splitViewData ? handleScroll : undefined}
      >
        <div
          className={`h-full w-full ${splitViewData ? 'overflow-y-auto overflow-x-hidden' : ''}`}
          style={splitViewData ? { maxWidth: '100%' } : undefined}
          onScroll={splitViewData ? handleScroll : undefined}
        >
        {/* Floating Sidebar Toggle */}
        {!isSidebarOpen && !splitViewData && (
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

        <div 
          className="mx-auto w-full min-h-full px-8 transition-all duration-300 ease-in-out"
          style={{ maxWidth: `${layoutWidth}px`, minWidth: splitViewData ? undefined : `${layoutWidth}px` }}
        >
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
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleAiImportSelect} 
                          multiple 
                          accept="image/*" 
                          className="hidden" 
                        />
                        <button
                          onClick={() => setShowAiCommandBar(true)}
                          disabled={isAiImporting}
                          className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all disabled:opacity-30"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          Import AI
                        </button>
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
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAiImportSelect}
                        multiple
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => setShowAiCommandBar(true)}
                        disabled={isAiImporting}
                        className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all disabled:opacity-30"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Import AI
                      </button>
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
                containerWidth={splitViewData ? frozenCanvasWidthRef.current : canvasContainerWidth}
                onSavingChange={setIsSaving}
                onActiveUrlsChange={setActiveUrls}
                onBlockRemoved={handleBlockRemoved}
                onResourceAdded={handleResourceAdded}
              />
              
              {/* Split View Dropzone Overlay */}
              {isDraggingSidebarItem && (
                <div 
                  className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[2px]"
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDragLeave={(e) => { e.preventDefault(); }}
                  onDrop={handleDropSplitView}
                >
                  <div className="bg-background border-2 border-dashed border-blue-500/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-2xl animate-in fade-in zoom-in-95 pointer-events-none">
                    <Columns className="w-10 h-10 text-blue-500 mb-4 opacity-80" />
                    <h3 className="text-xl font-bold text-foreground">Drop here for Side-by-Side view</h3>
                    <p className="text-sm text-muted-foreground mt-2">Open the item next to your canvas</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Split View Resize Handle + Pane ─────────────────────────────────── */}
      {splitViewData && (
        <>
          {/* Drag Handle */}
          <div
            className={`w-[3px] flex-shrink-0 cursor-col-resize z-50 transition-colors ${
              isDraggingSplitView ? 'bg-blue-500' : 'bg-transparent hover:bg-foreground/20'
            }`}
            onMouseDown={() => setIsDraggingSplitView(true)}
          />
          {/* Right Pane */}
          <div
            className={`flex-shrink-0 h-full overflow-hidden z-40 bg-background relative ${
              isDraggingSplitView ? '' : 'transition-all duration-300 ease-in-out'
            }`}
            style={{ width: 'var(--split-view-width, 35vw)', minWidth: '300px' }}
          >
            {/* Transparent overlay during drag to prevent iframe/canvas stealing mouse events */}
            {isDraggingSplitView && (
              <div className="absolute inset-0 z-50 bg-transparent cursor-col-resize" />
            )}
            <SplitViewer data={splitViewData} onClose={handleCloseSplitView} />
          </div>
        </>
      )}

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
        quickNotes={topic.captures?.filter(c => c.type === 'NOTE') || []}
        noteCategories={noteCategories || []}
        resources={localResources}
        activeUrls={activeUrls}
        onMentionClick={handleMentionClick}
        onDeleteResource={handleResourceDelete}
        onDeleteMultipleResources={handleMultipleResourceDelete}
        onRenameResource={handleResourceRename}
        onDeleteMention={handleDeleteMention}
        onDragStartSidebarItem={handleDragStartSidebarItem}
        onOpenSplitView={handleOpenSplitView}
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
        topic={topic}
      />
      {rawImagesForCrop && (
        <AiImportCropperModal
          files={rawImagesForCrop}
          onConfirm={processAiCommand}
          onCancel={() => setRawImagesForCrop(null)}
        />
      )}

      {/* ── AI Command Bar ─────────────────────────────────────────────── */}
      {showAiCommandBar && (
        <FloatingCommandBar 
          onSubmit={(files, text, taggedBlocks) => processAiCommand(files, text, taggedBlocks)}
          onCancel={() => setShowAiCommandBar(false)} 
        />
      )}
    </div>
  );
}