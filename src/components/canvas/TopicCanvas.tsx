'use client';

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { SingleCanvas } from './core/SingleCanvas';
import { useCanvasState } from './core/useCanvasState';
import { canvasOfflineStorage } from '@/lib/storage/canvasOfflineStorage';
import { saveCanvasData } from '@/app/actions';
import { useAppStore } from '@/store/useAppStore';

interface TopicCanvasProps {
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
  onBlockRemoved?: (block: any) => void;
  onResourceAdded?: (resource: any) => void;
  readOnly?: boolean;
}

const NOOP = () => {};

const MemoizedTopicCanvas = React.memo(function TopicCanvas({
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
  onBlockRemoved,
  onResourceAdded,
  readOnly = false,
}: TopicCanvasProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const typography = useAppStore(state => state.typography);
  const effectiveCanvasWidth = typography?.canvasWidth ?? 890;

  // Auto-zoom: scale canvas when container is narrower than effectiveCanvasWidth
  const autoZoom = useMemo(() => {
    if (!containerWidth || containerWidth >= effectiveCanvasWidth) return 1;
    return containerWidth / effectiveCanvasWidth;
  }, [containerWidth, effectiveCanvasWidth]);

  const canvasStateRef = useRef({ blocks: [] as any[], connections: [] as any[] });

  const handleCanvasChange = React.useCallback(() => {
    onChange?.();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setIsSaving(true);
      onSavingChange?.(true);

      const content = JSON.stringify(canvasStateRef.current);

      // 1. Save to IndexedDB (fast, offline cache)
      await canvasOfflineStorage.saveDoc(topicId, content, title || 'Untitled Topic').catch(() => {});

      // 2. Save to server (persistent storage)
      try {
        const parsed = JSON.parse(content);
        await saveCanvasData(topicId, parsed);
      } catch (e) {
        console.error('[TopicCanvas] Server save failed:', e);
      }

      setTimeout(() => {
        setIsSaving(false);
        onSavingChange?.(false);
      }, 500);
    }, 2000); // 2s debounce per Master Plan
  }, [topicId, title, onChange, onSavingChange]);

  const {
    blocks,
    connections,
    selectedBlockId,
    selectedConnectionId,
    setSelectedBlockId,
    setSelectedConnectionId,
    setConnections,
    addBlock,
    updateBlock,
    deleteBlock,
    addImageBlock,
    addFileBlock,
    hydrate,
  } = useCanvasState(topicId, initialContent, handleCanvasChange, onBlockRemoved, onResourceAdded);

  React.useLayoutEffect(() => {
    canvasStateRef.current = { blocks, connections };
  }, [blocks, connections]);

  // Expose active URLs for sidebar bifurcation
  const activeUrls = useMemo(() => {
    return new Set(
      blocks
        .filter(b => (b.type === 'image' || b.type === 'file') && b.url)
        .map(b => b.url as string)
    );
  }, [blocks]);

  const prevUrlsRef = useRef<string>('');
  useEffect(() => {
    const currentUrls = Array.from(activeUrls).sort().join(',');
    if (currentUrls !== prevUrlsRef.current) {
      prevUrlsRef.current = currentUrls;
      onActiveUrlsChange?.(Array.from(activeUrls));
    }
  }, [activeUrls, onActiveUrlsChange]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const doc = await canvasOfflineStorage.loadDoc(topicId);
        if (doc && doc.content) {
          await hydrate(doc.content);
        } else if (initialContent) {
          await hydrate(initialContent);
        }
      } catch (err) {
        console.error('Failed to load canvas from IndexedDB:', err);
        if (initialContent) {
          await hydrate(initialContent);
        }
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, [topicId, hydrate, initialContent]);

  // ---------------------------------------------------------------------------
  // Global keyboard handler — mirrors recollect SlideCanvas.tsx
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const isTyping =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement)?.isContentEditable ||
        (el as HTMLElement)?.contentEditable === 'true';

      // Ctrl/Cmd + A  →  select all blocks
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (!isTyping) {
          e.preventDefault();
          setSelectedBlockId('ALL');
          return;
        }
      }

      // Delete / Backspace  →  delete selected block(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        if (!isTyping) {
          e.preventDefault();
          if (selectedBlockId === 'ALL') {
            blocks.forEach(b => deleteBlock(b.blockId));
            setSelectedBlockId(null);
          } else {
            deleteBlock(selectedBlockId);
          }
          return;
        }
      }

      // Delete / Backspace  →  delete selected connection
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedConnectionId &&
        !selectedBlockId
      ) {
        if (!isTyping) {
          e.preventDefault();
          setConnections(connections.filter(c => c.id !== selectedConnectionId));
          setSelectedConnectionId(null);
          return;
        }
      }

      // Escape  →  deselect everything
      if (e.key === 'Escape') {
        setSelectedBlockId(null);
        setSelectedConnectionId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, selectedConnectionId, blocks, connections, deleteBlock, setSelectedBlockId, setSelectedConnectionId, setConnections]);

  if (!isLoaded) {
    return <div className="w-full min-h-full min-h-[600px] bg-background relative flex items-center justify-center">
      <div className="text-muted-foreground animate-pulse">Loading canvas...</div>
    </div>;
  }

  return (
    <div className="w-full min-h-full min-h-[600px] bg-background relative overflow-hidden" onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedBlockId(null);
        setSelectedConnectionId(null);
      }
    }}>
      <div className="mx-auto" style={{
        width: effectiveCanvasWidth * autoZoom,
      }}>
        <div style={{
          transform: `scale(${autoZoom})`,
          transformOrigin: 'top left',
          width: effectiveCanvasWidth,
        }}>
          <SingleCanvas
            canvasId={topicId}
            subjectId={subjectId}
            blocks={blocks}
            connections={connections}
            selectedBlockId={selectedBlockId}
            selectedConnectionId={selectedConnectionId}
            isActive={true}
            title={title}
            showTitle={showTitle}
            zoom={autoZoom}
            readOnly={readOnly}
            onSelectBlock={setSelectedBlockId}
            onUpdateBlock={updateBlock}
            onDeleteBlock={deleteBlock}
            onAddBlock={addBlock}
            onCanvasClick={NOOP}
            onConnectionsChange={setConnections}
            onSelectConnection={setSelectedConnectionId}
            onAddImage={addImageBlock}
            onAddFile={addFileBlock}
            onMentionClick={onMentionClick}
            onResourceAdd={onResourceAdded}
          />
        </div>
      </div>
    </div>
  );
});

export function TopicCanvas(props: TopicCanvasProps) {
  return <MemoizedTopicCanvas {...props} />;
}
