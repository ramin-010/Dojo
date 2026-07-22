'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { BlockEditor } from './blocks/BlockEditor';
import { saveCanvasData } from '@/app/actions';
import { canvasOfflineStorage } from '@/lib/storage/canvasOfflineStorage';
import { uploadToCloud } from '@/lib/utils/upload';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { useAppStore } from '@/store/useAppStore';

interface TopicEditorProps {
  topicId: string;
  subjectId?: string;
  initialContent?: string;
  onChange?: () => void;
  title?: string;
  showTitle?: boolean;
  onMentionClick?: (topicId: string) => void;
  containerWidth?: number;
  onSavingChange?: (isSaving: boolean) => void;
  onActiveUrlsChange?: (urls: string[]) => void;
  onResourceAdded?: (resource: any) => void;
  readOnly?: boolean;
}

export function TopicEditor({
  topicId,
  subjectId,
  initialContent,
  onChange,
  title,
  showTitle = false,
  onMentionClick,
  containerWidth,
  onSavingChange,
  onActiveUrlsChange,
  onResourceAdded,
  readOnly = false,
}: TopicEditorProps) {
  const [content, setContent] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const typography = useAppStore(state => state.typography);
  
  // Track current content in ref for global events
  const contentRef = useRef('');

  // 1. Backward Compatibility & Initialization
  useEffect(() => {
    if (!initialContent) {
      setContent('');
      contentRef.current = '';
      setIsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(initialContent);
      if (Array.isArray(parsed) || (parsed && parsed.blocks && Array.isArray(parsed.blocks))) {
        // It's the old spatial canvas data format!
        // Sort blocks top-to-bottom
        const blocks = Array.isArray(parsed) ? parsed : parsed.blocks;
        const sortedBlocks = [...blocks].sort((a, b) => a.position.y - b.position.y);
        const concatenatedHtml = sortedBlocks.map(b => b.content).join('<p></p>');
        setContent(concatenatedHtml);
        contentRef.current = concatenatedHtml;
      } else if (parsed && parsed.type === 'linear-document' && typeof parsed.html === 'string') {
        // It's the new linear document format wrapped in JSON
        setContent(parsed.html);
        contentRef.current = parsed.html;
      } else {
        // Fallback
        setContent(initialContent);
        contentRef.current = initialContent;
      }
    } catch (e) {
      // Not JSON, probably plain HTML or text
      setContent(initialContent);
      contentRef.current = initialContent;
    }
    setIsLoaded(true);
  }, [topicId, initialContent]);

  // 2. Autosave logic
  const debouncedSave = useMemo(
    () => debounce(async (html: string) => {
      onSavingChange?.(true);

      const payload = { type: 'linear-document', html };
      const contentStr = JSON.stringify(payload);

      // Save to IndexedDB (fast, offline cache)
      await canvasOfflineStorage.saveDoc(topicId, contentStr, title || 'Untitled Topic').catch(() => {});

      // Save to server
      try {
        await saveCanvasData(topicId, payload);
      } catch (e) {
        console.error('[TopicEditor] Server save failed:', e);
      }

      setTimeout(() => {
        onSavingChange?.(false);
      }, 500);
    }, 2000), // 2s debounce
    [topicId, title, onSavingChange]
  );

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleChange = useCallback((newHtml: string) => {
    setContent(newHtml);
    contentRef.current = newHtml;
    onChange?.();
    debouncedSave(newHtml);
  }, [onChange, debouncedSave]);

  // 3. AI Import / Global Event Listeners
  useEffect(() => {
    const handleRequestAll = () => {
      // The AI import looks for an array of blocks with content.
      // We simulate one giant block so the AI gets the whole document.
      const simulatedBlocks = [
        { id: 'linear-doc', content: contentRef.current, position: { x: 0, y: 0 } }
      ];
      window.dispatchEvent(new CustomEvent('RESPONSE_ALL_CANVAS_BLOCKS', { detail: { blocks: simulatedBlocks } }));
    };

    const handleApplyAiImport = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { text } = customEvent.detail;
      if (!text) return;
      // The AI returns rich HTML (h1, h2, blockquote, pre, etc.)
      // Append it directly to the document
      handleChange(contentRef.current + text);
    };

    window.addEventListener('REQUEST_ALL_CANVAS_BLOCKS', handleRequestAll);
    window.addEventListener('APPLY_AI_IMPORT', handleApplyAiImport);

    return () => {
      window.removeEventListener('REQUEST_ALL_CANVAS_BLOCKS', handleRequestAll);
      window.removeEventListener('APPLY_AI_IMPORT', handleApplyAiImport);
    };
  }, [handleChange]);

  // 4. Image Uploading
  const handleUploadImage = useCallback(async (file: File) => {
    // 1. Save to cloud
    const result = await uploadToCloud(
      file,
      uuidv4(), // imageId
      topicId,
      subjectId || 'unassigned'
    );
    const cloudUrl = result.url;
    
    // 2. Ensure topic is saved locally
    const payload = { type: 'linear-document', html: contentRef.current };
    await canvasOfflineStorage.saveDoc(topicId, JSON.stringify(payload), title || 'Untitled Topic').catch(() => {});
    
    return cloudUrl;
  }, [topicId, subjectId, title]);

  if (!isLoaded) return null;

  return (
    <div 
      className="w-full min-h-[calc(100vh-100px)] py-2 px-2 focus:outline-none focus:ring-0"
      style={{ 
        fontSize: typography?.fontSize ? `${typography.fontSize}px` : '16px',
        lineHeight: typography?.lineHeight || 1.6,
        fontFamily: (typography as any)?.fontFamily || 'inherit'
      }}
      onClick={(e) => {
        // If clicking on the empty space of the wrapper, 
        // we might want to focus the editor if we had a ref,
        // but BlockEditor is pretty good at grabbing focus already.
      }}
    >
      <BlockEditor
        content={content}
        onChange={handleChange}
        readOnly={readOnly}
        onMentionClick={onMentionClick}
        onResourceAdd={onResourceAdded}
        onUploadImage={handleUploadImage}
        topicId={topicId}
        subjectId={subjectId}
      />
    </div>
  );
}
