'use client';

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { SingleCanvas } from './core/SingleCanvas';
import { useCanvasState } from './core/useCanvasState';
import { canvasOfflineStorage } from '@/lib/storage/canvasOfflineStorage';
import { CANVAS_WIDTH } from './core/types';

interface TopicCanvasProps {
  topicId: string;
  initialContent?: string;
  onChange?: (content: string) => void;
  title?: string;
  showTitle?: boolean;
  onMentionClick?: (topicId: string) => void;
  containerWidth?: number;
  onSavingChange?: (isSaving: boolean) => void;
}

export function TopicCanvas({
  topicId,
  initialContent,
  onChange,
  title,
  showTitle = false,
  onMentionClick,
  containerWidth,
  onSavingChange,
}: TopicCanvasProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-zoom: scale canvas when container is narrower than CANVAS_WIDTH
  const autoZoom = useMemo(() => {
    if (!containerWidth || containerWidth >= CANVAS_WIDTH) return 1;
    return containerWidth / CANVAS_WIDTH;
  }, [containerWidth]);

  const handleCanvasChange = React.useCallback((content: string) => {
    onChange?.(content);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setIsSaving(true);
      onSavingChange?.(true);
      await canvasOfflineStorage.saveDoc(topicId, content, title || 'Untitled Topic').catch(() => {});
      setTimeout(() => {
        setIsSaving(false);
        onSavingChange?.(false);
      }, 500);
    }, 1000);
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
    hydrate,
  } = useCanvasState(topicId, initialContent, handleCanvasChange);

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
    return <div className="w-full h-full min-h-[600px] bg-background relative flex items-center justify-center">
      <div className="text-muted-foreground animate-pulse">Loading canvas...</div>
    </div>;
  }

  return (
    <div className="w-full h-full min-h-[600px] bg-background relative overflow-hidden" onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedBlockId(null);
        setSelectedConnectionId(null);
      }
    }}>
      <div className="mx-auto" style={{
        width: CANVAS_WIDTH * autoZoom,
      }}>
        <div style={{
          transform: `scale(${autoZoom})`,
          transformOrigin: 'top left',
          width: CANVAS_WIDTH,
        }}>
          <SingleCanvas
            canvasId={topicId}
            blocks={blocks}
            connections={connections}
            selectedBlockId={selectedBlockId}
            selectedConnectionId={selectedConnectionId}
            isActive={true}
            title={title}
            showTitle={showTitle}
            zoom={autoZoom}
            onSelectBlock={setSelectedBlockId}
            onUpdateBlock={updateBlock}
            onDeleteBlock={deleteBlock}
            onAddBlock={addBlock}
            onCanvasClick={() => {}}
            onConnectionsChange={setConnections}
            onSelectConnection={setSelectedConnectionId}
            onAddImage={addImageBlock}
            onMentionClick={onMentionClick}
          />
        </div>
      </div>
    </div>
  );
}
