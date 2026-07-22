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
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopicEditor } from '@/components/canvas/TopicEditor';
import { timeAgo } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { createTopic, deleteCapturePermanently, getTopicLinks, createTextCaptureLink, renameCapture, deleteMultipleCapturesPermanently, deleteTopicMention, saveCanvasData, toggleTopicCapturePin, getTopicPinnedCaptures } from '@/app/actions';
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
  const [pinnedCaptures, setPinnedCaptures] = useState<any[]>(topic.captureLinks?.map(l => l.capture) || []);
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  useEffect(() => {
    setLocalResources(topic.captures?.filter(c => c.type === 'LINK') || []);
    setPinnedCaptures(topic.captureLinks?.map(l => l.capture) || []);
  }, [topic.captures, topic.captureLinks]);

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

  const processAiCommand = async (croppedFiles: File[], userContext?: string, selectedContext?: { text: string; html: string; range: { from: number; to: number }; contextPills?: { label: string; content: string }[] } | null, actionType: 'ai' | 'enhance' = 'ai') => {
    setRawImagesForCrop(null); // Close modal immediately if open
    setShowAiCommandBar(false); // Close command bar

    console.log('[processAiCommand] contextPills:', selectedContext?.contextPills);

    if (actionType === 'enhance') {
      if (croppedFiles.length === 0) {
        toast.error('Please attach images to enhance.', { id: 'ai-import' });
        return;
      }
    } else {
      // Build combined context for AI path
      let combinedContext = userContext || '';
      if (selectedContext && selectedContext.text.trim()) {
        if (combinedContext) combinedContext += '\n\n--- SELECTED NOTES CONTEXT ---\n';
        combinedContext += selectedContext.text.trim();
      }

      if (croppedFiles.length === 0 && combinedContext.trim() === '') {
        toast.error('Please provide an image, a prompt, or highlighted context.', { id: 'ai-import' });
        return;
      }
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

        // Process 2 images at a time to prevent overloading the Python CV proxy
        const chunks = chunkArray(croppedFiles, 2);

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

      // ── ENHANCE path: just inject the cleaned cloud URLs as images ──
      if (actionType === 'enhance') {
        window.dispatchEvent(new CustomEvent('INJECT_IMAGES_INTO_EDITOR', { detail: { urls: imageUrls } }));
        toast.success(`Enhanced and injected ${imageUrls.length} image(s)!`, { id: 'ai-import' });
        return;
      }

      // ── AI path: build context with inline pill/image expansion ──
      // We parse the selection HTML, expand pills and image galleries inline,
      // then send the MODIFIED HTML directly to the AI (not plaintext).
      // This preserves code blocks, headings, structure — format-symmetric with the output.
      
      let combinedContext = userContext || '';
      const taggedImages: { id: string; url: string }[] = []; // Self-describing image references

      if (selectedContext?.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(selectedContext.html, 'text/html');

        // 1. Expand Context Pills inline safely (using inline-safe elements to prevent parent <p> fragmentation)
        const pillElements = doc.querySelectorAll('span[data-type="context-pill"]');
        pillElements.forEach((el) => {
          const label = el.getAttribute('data-label') || 'Context Pill';
          let content = el.getAttribute('data-content') || '';
          
          if (content.trim()) {
            // Use inline-safe elements (span, br, code) because `el` is inside a <p>.
            // Inserting <blockquote> or <hr> inside a <p> causes invalid HTML and browser DOM mutation bugs.
            const pill = doc.createElement('span');
            pill.setAttribute('data-context-pill', label);
            pill.style.display = 'block'; // visually block, but semantically safe
            
            // Inject content safely via DOM text nodes to avoid ANY quote mangling
            const header = doc.createElement('span');
            header.innerHTML = `<br/><br/><strong>--- CONTEXT PILL: ${label} (use as background knowledge, do NOT reproduce verbatim) ---</strong><br/>`;
            
            const body = doc.createElement('code');
            body.style.display = 'block';
            body.style.whiteSpace = 'pre-wrap';
            body.textContent = content;
            
            const footer = doc.createElement('span');
            footer.innerHTML = `<br/><strong>--- END CONTEXT PILL ---</strong><br/><br/>`;
            
            pill.appendChild(header);
            pill.appendChild(body);
            pill.appendChild(footer);
            el.replaceWith(pill);
          } else {
            el.remove();
          }
        });

        // 2. Replace Image Galleries with positional markers + collect their URLs
        let inlineImageIndex = 1;
        const galleryElements = doc.querySelectorAll('div[data-type="image-gallery"]');
        galleryElements.forEach((el) => {
          try {
            const imagesData = JSON.parse(el.getAttribute('data-images') || '[]');
            const markerElements: HTMLElement[] = [];
            imagesData.forEach((img: any) => {
              if (img.src) {
                const id = `INLINE_IMAGE_${inlineImageIndex}`;
                const alt = img.alt || '';
                taggedImages.push({ id, url: img.src });
                
                const marker = doc.createElement('p');
                marker.innerHTML = `<strong>[${id}${alt ? `: ${alt}` : ''}]</strong>`;
                markerElements.push(marker);
                inlineImageIndex++;
              }
            });
            if (markerElements.length > 0) {
              const wrapper = doc.createDocumentFragment();
              wrapper.appendChild(doc.createElement('hr'));
              markerElements.forEach(m => wrapper.appendChild(m));
              wrapper.appendChild(doc.createElement('hr'));
              el.replaceWith(wrapper);
            } else {
              el.remove();
            }
          } catch {
            el.remove();
          }
        });

        // 3. Expand Mermaid diagrams into standard markdown code blocks
        // The AI expects <pre><code class="language-mermaid"> for proper rule matching
        const mermaidElements = doc.querySelectorAll('div[data-type="mermaid"]');
        mermaidElements.forEach((el) => {
          const code = el.getAttribute('code') || el.getAttribute('data-code') || '';
          if (code.trim()) {
            const pre = doc.createElement('pre');
            const codeEl = doc.createElement('code');
            codeEl.className = 'language-mermaid';
            codeEl.textContent = code;
            pre.appendChild(codeEl);
            el.replaceWith(pre);
          } else {
            el.remove();
          }
        });

        // 4. Send the MODIFIED HTML directly — preserves code blocks, headings, structure
        const processedHtml = doc.body.innerHTML?.trim() || '';
        if (processedHtml) {
          if (combinedContext) combinedContext += '\n\n--- SELECTED NOTES CONTEXT (HTML) ---\n';
          combinedContext += processedHtml;
        }

        console.log('[processAiCommand] Inline expansion — pills:', pillElements.length, 'galleries:', galleryElements.length, 'mermaid:', mermaidElements.length, 'inline images:', taggedImages.length);
      } else if (selectedContext?.text?.trim()) {
        // Fallback: no HTML available, use plain text
        if (combinedContext) combinedContext += '\n\n--- SELECTED NOTES CONTEXT ---\n';
        combinedContext += selectedContext.text.trim();
      }

      // Add command-bar attached images with explicit tags (no positional marker — not in doc)
      let cmdBarIndex = 1;
      imageUrls.forEach((url) => {
        taggedImages.push({ id: `COMMAND_BAR_${cmdBarIndex}`, url });
        cmdBarIndex++;
      });

      // Extract just the URLs for the API (order matches taggedImages)
      const allImageUrls = taggedImages.map(t => t.url);

      toast.loading(croppedFiles.length > 0 || taggedImages.some(t => t.id.startsWith('INLINE')) ? 'AI is synthesizing your notes...' : 'AI is processing your context...', { id: 'ai-import' });

      // ── DEBUG: Log exact payload being sent to the AI backend ──
      console.log('═══════════════════════════════════════════');
      console.log('[processAiCommand] EXACT PAYLOAD TO BACKEND:');
      console.log('── userContext (full string) ──');
      console.log(combinedContext);
      console.log('── taggedImages (self-describing) ──');
      console.log(taggedImages);
      console.log('═══════════════════════════════════════════');

      const geminiRes = await fetch('/api/canvas/extract-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: allImageUrls.length > 0 ? allImageUrls : undefined, userContext: combinedContext || undefined }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(errText || 'AI extraction failed');
      }
      const { blocks } = await geminiRes.json();

      if (!blocks || blocks.length === 0) {
        throw new Error('No blocks returned from AI');
      }

      // Inject the AI-generated HTML into the editor
      const htmlContent = blocks.map((b: any) => b.content || '').join('');

      if (selectedContext && selectedContext.range) {
        window.dispatchEvent(new CustomEvent('APPLY_AI_IMPORT', {
          detail: { text: htmlContent, replaceRange: selectedContext.range }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('APPLY_AI_IMPORT', {
          detail: { text: htmlContent }
        }));
      }

      toast.success('Notes successfully synthesized!', { id: 'ai-import' });

    } catch (error: any) {
      console.error('[AI Import] Error:', error);
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
    nextPendingRevision,
  } = useTopicRevisions({
    topicId: topic.id,
    revisions: topic.revisions,
  });

  const isRecallMode = nextPendingRevision && nextPendingRevision.cycleNumber > 1 && nextPendingRevision.cycleNumber < 5;

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
    if (!isDraggingSplitView && canvasWrapperRef.current) {
      // Sync the container width after drag ends since ResizeObserver skips updates during drag
      setCanvasContainerWidth(canvasWrapperRef.current.getBoundingClientRect().width);
    }
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

  const handlePinCapture = useCallback(async (captureId: string) => {
    try {
      await toggleTopicCapturePin(topic.id, captureId, true);
      toast.success('Pinned to topic');
      const fresh = await getTopicPinnedCaptures(topic.id);
      setPinnedCaptures(fresh);
    } catch (e) {
      toast.error('Failed to pin capture');
    }
  }, [topic.id]);

  const handleUnpinCapture = useCallback(async (captureId: string) => {
    try {
      await toggleTopicCapturePin(topic.id, captureId, false);
      toast.success('Unpinned from topic');
      setPinnedCaptures(prev => prev.filter(r => r.id !== captureId));
    } catch (e) {
      toast.error('Failed to unpin capture');
    }
  }, [topic.id]);

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

  // Global event listener for detecting images deleted from the editor to offer permanent cleanup
  useEffect(() => {
    const handleImageDeletion = (e: Event) => {
      const customEvent = e as CustomEvent<{ urls: string[] }>;
      if (customEvent.detail && customEvent.detail.urls && customEvent.detail.urls.length > 0) {
        const urls = customEvent.detail.urls;
        const toastId = `del-images-${Date.now()}`;
        toast(urls.length > 1 ? `${urls.length} images removed from document` : 'Image removed from document', {
          id: toastId,
          duration: 7000,
          action: {
            label: 'Delete Permanently',
            onClick: async (ev) => {
              ev.preventDefault();
              toast.dismiss(toastId);
              const delToastId = toast.loading(urls.length > 1 ? 'Deleting images permanently...' : 'Deleting image permanently...');
              try {
                for (const url of urls) {
                  await deleteCapturePermanently(url);
                }
                toast.success(urls.length > 1 ? 'Images deleted permanently' : 'Image deleted permanently', { id: delToastId });
              } catch (err) {
                console.error('Failed to permanently delete image(s):', err);
                toast.error('Failed to delete', { id: delToastId });
              }
            }
          }
        });
      }
    };
    
    window.addEventListener('IMAGES_DELETED_FROM_EDITOR', handleImageDeletion);
    return () => window.removeEventListener('IMAGES_DELETED_FROM_EDITOR', handleImageDeletion);
  }, []);

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
                        {!!isRecallMode && (
                          <button
                            onClick={() => setIsAllExpanded(!isAllExpanded)}
                            className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all"
                          >
                            {isAllExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {isAllExpanded ? 'Collapse' : 'Reveal'}
                          </button>
                        )}
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
                      {!!isRecallMode && (
                        <button
                          onClick={() => setIsAllExpanded(!isAllExpanded)}
                          title={isAllExpanded ? "Collapse All Blocks" : "Reveal All Blocks"}
                          className="flex items-center gap-1 text-[#888888] hover:text-foreground text-[11px] opacity-70 hover:opacity-100 font-medium transition-all"
                        >
                          {isAllExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {isAllExpanded ? 'Collapse' : 'Reveal'}
                        </button>
                      )}
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
              <TopicEditor
                topicId={topic.id}
                subjectId={topic.subject.id}
                initialContent={initialCanvasContent}
                onMentionClick={handleMentionClick}
                containerWidth={splitViewData ? frozenCanvasWidthRef.current : canvasContainerWidth}
                onSavingChange={setIsSaving}
                onActiveUrlsChange={setActiveUrls}
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
        pinnedCaptures={pinnedCaptures}
        activeUrls={activeUrls}
        onMentionClick={handleMentionClick}
        onDeleteResource={handleResourceDelete}
        onDeleteMultipleResources={handleMultipleResourceDelete}
        onRenameResource={handleResourceRename}
        onDeleteMention={handleDeleteMention}
        onDragStartSidebarItem={handleDragStartSidebarItem}
        onOpenSplitView={handleOpenSplitView}
        onPinCapture={handlePinCapture}
        onUnpinCapture={handleUnpinCapture}
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
          onSubmit={(files, text, selectedCtx, actionType) => processAiCommand(files, text, selectedCtx, actionType)}
          onCancel={() => setShowAiCommandBar(false)} 
        />
      )}
    </div>
  );
}

