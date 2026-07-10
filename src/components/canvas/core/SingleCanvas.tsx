'use client';

import React, { useRef } from 'react';
import { CanvasBlockData, CANVAS_MIN_HEIGHT, GUIDE_LINE_SPACING, DEFAULT_FONT_SIZE } from './types';
import { Connection } from '@/types/canvas';
import { CanvasBlockLayer } from '../blocks/CanvasBlockLayer';
import { InlineCursor } from '../blocks/InlineCursor';
import { CanvasBlockMenu } from '../blocks/CanvasBlockMenu';
import { NativeConnectionLayer } from '../rendering/NativeConnectionLayer';
import { ConnectionLayer } from '../rendering/ConnectionLayer';
import { CanvasHeader } from './CanvasHeader';
import { useCanvasHandlers } from './useCanvasHandlers';
import { useAppStore } from '@/store/useAppStore';

export const TITLE_HEIGHT = 105;
export const COVER_HEIGHT = 192;
export const SIDE_PADDING = 3;
export const VERTICAL_PADDING = 5;

interface SingleCanvasProps {
  canvasId: string;
  subjectId?: string;
  blocks: CanvasBlockData[];
  connections: Connection[];
  selectedBlockId: string | null;
  selectedConnectionId: string | null;
  isActive: boolean;
  readOnly?: boolean;
  backgroundColor?: string;
  title?: string;
  showTitle?: boolean;
  coverImage?: string | null;
  onTitleChange?: (title: string) => void;
  onToggleTitle?: (show: boolean) => void;
  onCoverChange?: (url: string | null) => void;
  zoom: number;

  onSelectBlock: (id: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<CanvasBlockData>) => void;
  onDeleteBlock: (blockId: string) => void;
  onAddBlock: (canvasId: string, type: CanvasBlockData['type'], x?: number, y?: number) => string;
  onCanvasClick: (canvasId: string) => void;
  onConnectionsChange: (connections: Connection[]) => void;
  onSelectConnection: (id: string | null) => void;
  onAddImage?: (canvasId: string, file: File, x?: number, y?: number) => void;
  onAddFile?: (canvasId: string, file: File, x?: number, y?: number) => void;
  onMentionClick?: (topicId: string) => void;
  onResourceAdd?: (data: { text: string; type: 'url' | 'text' }) => void;
  canvasWidth?: number;
}

export function SingleCanvas({
  canvasId,
  subjectId,
  blocks,
  connections,
  selectedBlockId,
  selectedConnectionId,
  isActive,
  readOnly,
  backgroundColor,
  title,
  showTitle,
  coverImage,
  onTitleChange,
  onToggleTitle,
  onCoverChange,
  zoom,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onAddBlock,
  onCanvasClick,
  onConnectionsChange,
  onSelectConnection,
  onAddImage,
  onAddFile,
  onMentionClick,
  onResourceAdd,
  canvasWidth,
}: SingleCanvasProps) {
  const typography = useAppStore(state => state.typography);
  const effectiveCanvasWidth = canvasWidth || (typography?.canvasWidth ?? 890);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const absoluteMouseRef = useRef({ clientX: 0, clientY: 0 });

  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      absoluteMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // Paste handler moved below useCanvasHandlers — see below

  const h = useCanvasHandlers({
    canvasId,
    blocks,
    connections,
    selectedBlockId,
    selectedConnectionId,
    isActive,
    showTitle,
    zoom,
    onSelectBlock,
    onUpdateBlock,
    onDeleteBlock,
    onAddBlock,
    onCanvasClick,
    onConnectionsChange,
    onSelectConnection,
    containerRef,
    headerRef,
  });

  const hRef = React.useRef(h);
  React.useLayoutEffect(() => {
    hRef.current = h;
  }, [h]);

  // Paste handler — reads clipboard HTML/text and routes through InlineCursor
  React.useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isActive) return;
      const target = e.target as HTMLElement;

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const isInsideEditor =
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') !== null ||
        document.querySelector('.inline-cursor-editor') !== null;

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { clientX, clientY } = absoluteMouseRef.current;

      if (
        clientX < rect.left || clientX > rect.right ||
        clientY < rect.top || clientY > rect.bottom
      ) {
        return;
      }

      const rawX = (clientX - rect.left) / zoom;
      const rawY = (clientY - rect.top) / zoom;

      const x = Math.max(SIDE_PADDING, rawX);
      const y = Math.max(VERTICAL_PADDING, rawY);

      const items = e.clipboardData?.items;
      if (!items) return;

      // Check for files (images or others)
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            if (file.type.startsWith('image/')) {
              e.preventDefault();
              if (onAddImage) await onAddImage(canvasId, file, x, y);
              return;
            } else {
              // It's a non-image file (PDF, Doc, Zip, etc)
              e.preventDefault();
              if (onAddFile) await onAddFile(canvasId, file, x, y);
              return;
            }
          }
        }
      }

      // If inside an editor, let Tiptap handle paste natively
      if (isInsideEditor) return;

      // Try to read HTML first (preserves rich formatting from websites/Notion)
      const htmlItem = Array.from(items).find(item => item.type === 'text/html');
      const textItem = Array.from(items).find(item => item.type === 'text/plain');

      if (htmlItem) {
        e.preventDefault();
        htmlItem.getAsString((html) => {
          const trimmed = html.trim();
          if (!trimmed) return;
          // Open InlineCursor with the HTML — Tiptap parses it through its schema
          hRef.current.handlePasteAsNewBlock(x, y, trimmed);
        });
      } else if (textItem) {
        e.preventDefault();
        textItem.getAsString((text) => {
          const trimmed = text.trim();
          if (!trimmed) return;

          // URL → embed block (existing behavior)
          if (/^https?:\/\/\S+$/i.test(trimmed)) {
            const blockId = onAddBlock(canvasId, 'embed', x, y);
            if (blockId) onUpdateBlock(blockId, { content: trimmed });
            return;
          }

          // Convert plain text newlines to HTML paragraphs
          const html = trimmed
            .split(/\n\n+/)
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('');
          hRef.current.handlePasteAsNewBlock(x, y, html);
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isActive, canvasId, onAddImage, onAddBlock, onUpdateBlock, zoom]);

  return (
    <div
      className="relative group transition-all duration-200 h-full rounded-lg w-full"
    >
      <div
        ref={containerRef}
        onClick={h.handleSingleClick}
        onDoubleClick={h.handleDoubleClick}
        className="relative rounded-lg bg-transparent w-full"
        style={{
          minHeight: CANVAS_MIN_HEIGHT,
          height: h.computedHeight,
          backgroundColor: backgroundColor || undefined,
        }}
      >
        <CanvasHeader
          coverImage={coverImage}
          showTitle={showTitle}
          title={title}
          readOnly={readOnly}
          showCoverPicker={h.showCoverPicker}
          setShowCoverPicker={h.setShowCoverPicker}
          onTitleChange={onTitleChange}
          onToggleTitle={onToggleTitle}
          onCoverChange={onCoverChange}
          headerRef={headerRef}
        />

        <div 
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
            h.isDraggingBlock ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: `linear-gradient(to bottom, transparent calc(${GUIDE_LINE_SPACING}px - 1px), hsl(var(--muted-foreground)) calc(${GUIDE_LINE_SPACING}px - 1px))`,
              backgroundSize: `100% ${GUIDE_LINE_SPACING}px`,
            }}
          />
        </div>

        <NativeConnectionLayer
          connections={connections}
          blocks={h.blockDims}
          dragController={h.dragControllerInstance}
          selectedConnectionId={selectedConnectionId}
          onSelectConnection={h.handleSelectConnectionWrapper}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          zoom={zoom}
        />

        <CanvasBlockLayer
          blocks={h.cursorPos && h.editingBlockId ? blocks.filter(b => b.blockId !== h.editingBlockId) : blocks}
          connections={connections}
          selectedBlockId={selectedBlockId}
          readOnly={readOnly}
          onDragStop={h.handleDragStopWithController}
          onDragStart={h.handleDragStart}
          onUpdateBlock={onUpdateBlock}
          onDeleteBlock={onDeleteBlock}
          onSelectBlock={onSelectBlock}
          onDimensionsChange={h.handleDimensionsChange}
          onAnchorMouseDown={h.handleAnchorMouseDown}
          isConnectionDragging={!!h.activeDragStart}
          dragController={h.dragControllerInstance}
          zoom={zoom}
          onEditRequest={h.handleEditRequest}
          onMentionClick={onMentionClick}
          editingBlockId={h.editingBlockId}
          onResourceAdd={onResourceAdd}
          topicId={canvasId}
          subjectId={subjectId}
          onRegisterHeight={h.registerBlockHeight}
          canvasWidth={effectiveCanvasWidth}
        />

        <ConnectionLayer
          connections={connections}
          setConnections={h.setConnections as any}
          blocks={h.blockDims}
          activeDragStart={h.activeDragStart}
          onDragComplete={h.handleConnectionDragComplete}
          getCanvasPoint={h.getCanvasPoint}
          selectedConnectionId={selectedConnectionId}
          onSelectConnection={(id: string) => onSelectConnection(id)}
          variant="default"
          zoom={zoom}
          renderConnections={false}
        />

        {selectedConnectionId && (
          <ConnectionLayer
            connections={connections}
            setConnections={h.setConnections as any}
            blocks={h.blockDims}
            activeDragStart={null}
            onDragComplete={() => {}}
            getCanvasPoint={h.getCanvasPoint}
            selectedConnectionId={selectedConnectionId}
            onSelectConnection={(id: string) => onSelectConnection(id)}
            variant="controls"
            zoom={zoom}
          />
        )}

        {!readOnly && (
          <CanvasBlockMenu
            onAddBlock={h.handleAddBlockFromMenu}
            onAddImage={onAddImage ? (file) => onAddImage(canvasId, file) : undefined}
          />
        )}

        {h.cursorPos && (
          <InlineCursor
            key={h.cursorKeyRef.current} 
            x={h.cursorPos.x}
            y={h.cursorPos.y}
            id={h.editingBlockId}
            initialContent={h.editingBlockContent}
            color={h.editingBlockData?.color}
            textColor={h.editingBlockData?.textColor}
            fontSize={h.editingBlockData?.fontSize}
            initialMinWidth={h.editingBlockId && !h.isNewBlockEditing ? h.editingBlockData?.width : undefined}
            onCommit={h.handleCursorCommit}
            onDiscard={h.handleCursorDiscard}
            onChange={(html) => {
              const currentEditingId = h.editingBlockIdRef.current;
              if (!currentEditingId && h.cursorPos && h.isNewBlockEditing) {
                const newBlockId = onAddBlock(canvasId, 'text', h.cursorPos.x, h.cursorPos.y);
                if (newBlockId) {
                  h.setEditingBlockId(newBlockId);
                  onUpdateBlock(newBlockId, { content: html });
                }
                return;
              }
              if (currentEditingId) {
                onUpdateBlock(currentEditingId, { content: html });
              }
            }}
            onDimensionsChange={(w, h_) => h.setEditingDims(prev => {
              if (prev?.width === w && prev?.height === h_) return prev;
              return { width: w, height: h_ };
            })}
            zoom={zoom}
            onMoveCursor={h.handleMoveCursor}
            onResourceAdd={onResourceAdd}
            topicId={canvasId}
            subjectId={subjectId}
          />
        )}

        {!readOnly && blocks.length === 0 && !h.cursorPos && !h.editingBlockId && (
          <div className="absolute inset-0 flex items-center justify-center cursor-text empty-canvas-placeholder">
            <p className="text-sm text-muted-foreground/30 font-medium pointer-events-none">
              Click anywhere to start typing, or use the + button
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
