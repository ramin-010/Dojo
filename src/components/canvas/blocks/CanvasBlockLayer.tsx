'use client';

import React, { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { SmartBlock } from './SmartBlock';
import { DragController } from '../rendering/DragController';
import { CanvasBlockData, Connection, DEFAULT_FONT_SIZE } from '../core/types';
import { useAppStore } from '@/store/useAppStore';

const SIDE_PADDING = 4;

interface CanvasBlockLayerProps {
  blocks: CanvasBlockData[];
  connections: Connection[];
  selectedBlockId: string | null;
  readOnly?: boolean;
  onDragStop: (id: string, x: number, y: number) => void;
  onDrag?: (id: string, x: number, y: number) => void;
  onDragStart?: (id: string) => void;
  onUpdateBlock: (id: string, data: Partial<CanvasBlockData>) => void;
  onDeleteBlock: (id: string) => void;
  onSelectBlock: (id: string) => void;
  onDimensionsChange?: (id: string, width: number, height: number) => void;
  onAnchorMouseDown?: (id: string, side: any, e: any) => void;
  onAnchorMouseUp?: (id: string, side: any, e: any) => void;
  isConnectionDragging?: boolean;
  dragController?: DragController;
  zoom?: number;
  onEditRequest?: (id: string) => void;
  editingBlockId?: string | null;
  onMentionClick?: (id: string) => void;
  onResourceAdd?: (data: { text: string; type: 'url' | 'text' }) => void;
  topicId?: string;
  subjectId?: string;
  onRegisterHeight?: (id: string, height: number) => void;
}

interface BlockWrapperProps {
  block: CanvasBlockData;
  isSelected: boolean;
  isConnected: boolean;
  readOnly?: boolean;
  onDragStop: (id: string, x: number, y: number) => void;
  onDrag?: (id: string, x: number, y: number) => void;
  onDragStart?: (id: string) => void;
  onUpdateBlock: (id: string, data: Partial<CanvasBlockData>) => void;
  onDeleteBlock: (id: string) => void;
  onSelectBlock: (id: string) => void;
  onDimensionsChange?: (id: string, width: number, height: number) => void;
  onAnchorMouseDown?: (id: string, side: any, e: any) => void;
  onAnchorMouseUp?: (id: string, side: any, e: any) => void;
  isConnectionDragging?: boolean;
  dragController?: DragController;
  zoom?: number;
  onEditRequest?: (id: string) => void;
  editingBlockId?: string | null;
  onMentionClick?: (id: string) => void;
  onResourceAdd?: (data: { text: string; type: 'url' | 'text' }) => void;
  topicId?: string;
  subjectId?: string;
  onRegisterHeight?: (id: string, height: number) => void;
  effectiveCanvasWidth: number;
}

const BlockWrapperComponent = ({
  block,
  isSelected,
  isConnected,
  readOnly,
  onDragStop,
  onDrag,
  onDragStart,
  onUpdateBlock,
  onDeleteBlock,
  onSelectBlock,
  onDimensionsChange,
  onAnchorMouseDown,
  onAnchorMouseUp,
  isConnectionDragging,
  dragController,
  zoom,
  onEditRequest,
  editingBlockId,
  onMentionClick,
  onResourceAdd,
  topicId,
  subjectId,
  onRegisterHeight,
  effectiveCanvasWidth,
}: BlockWrapperProps) => {
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ width: number; fontSize: number } | null>(null);
  const [liveFontSize, setLiveFontSize] = useState<number | null>(null);
  const [resizingDir, setResizingDir] = useState<string | null>(null);

  const handleRndDragStop = useCallback((_e: any, d: any) => {
    onDragStop(block.blockId, d.x, d.y);
    dragController?.stopDrag();
  }, [block.blockId, onDragStop, dragController]);

  const handleRndDragStart = useCallback((_e: any, d: any) => {
    onDragStart?.(block.blockId);
    dragController?.startDrag(block.blockId);
  }, [block.blockId, onDragStart, dragController]);

  const handleRndDrag = useCallback((_e: any, d: any) => {
    onDrag?.(block.blockId, d.x, d.y);
    dragController?.update(block.blockId, d.x, d.y);
  }, [block.blockId, onDrag, dragController]);

  const handleResizeStart = useCallback((_e: any, dir: any) => {
    isResizingRef.current = true;
    setResizingDir(dir);
    // Capture initial dimensions for proportional font scaling
    resizeStartRef.current = {
      width: block.width,
      fontSize: (block.type === 'text' && block.fontSize) ? block.fontSize : DEFAULT_FONT_SIZE,
    };
  }, [block.width, block.fontSize, block.type]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const isText = block.type === 'text';

  const handleRndResize = useCallback((_e: any, dir: any, ref: any, _delta: any, _position: any) => {
    if (isText && resizeStartRef.current && dir === 'bottomRight') {
      const newWidth = ref.offsetWidth;
      const ratio = newWidth / resizeStartRef.current.width;
      const newFontSize = Math.round(Math.min(DEFAULT_FONT_SIZE, Math.max(8, resizeStartRef.current.fontSize * ratio)));
      setLiveFontSize(newFontSize);
    }
  }, [isText]);

  const handleResizeStop = useCallback((_e: any, dir: any, ref: any, _delta: any, position: any) => {
    isResizingRef.current = false;
    const newWidth = ref.offsetWidth;
    const newHeight = ref.offsetHeight;

    const updates: Partial<CanvasBlockData> = {
      width: newWidth,
      height: isText ? 'auto' : newHeight,
      x: position.x,
      y: position.y,
    };

    // Use the live font size if available
    if (isText && resizeStartRef.current && dir === 'bottomRight') {
      const ratio = newWidth / resizeStartRef.current.width;
      const finalFontSize = Math.round(Math.min(DEFAULT_FONT_SIZE, Math.max(8, resizeStartRef.current.fontSize * ratio)));
      updates.fontSize = finalFontSize;
    }
    
    resizeStartRef.current = null;
    setLiveFontSize(null);
    setResizingDir(null);

    onUpdateBlock(block.blockId, updates);
  }, [block.blockId, onUpdateBlock, isText]);

  const zIndex = isSelected ? 20 : 10;

  return (
    <Rnd
      key={block.blockId}
      id={block.blockId}
      scale={zoom || 1}
      position={{ x: block.x, y: block.y }}
      size={{
        width: block.width,
        height: isText ? 'auto' : (block.height === 'auto' ? 'auto' : block.height),
      }}
      maxWidth={effectiveCanvasWidth - block.x - SIDE_PADDING}
      onDragStop={handleRndDragStop}
      onDrag={handleRndDrag}
      onDragStart={handleRndDragStart}
      dragHandleClassName="smart-block-drag-handle"
      lockAspectRatio={isText && resizingDir === 'bottomRight'}
      enableResizing={{
        top: false, right: isText, bottom: !isText, left: false,
        topRight: false, bottomRight: true, bottomLeft: false, topLeft: false,
      }}
      onResizeStart={handleResizeStart}
      onResize={handleRndResize}
      onResizeStop={handleResizeStop}
      className="z-100"
      style={{ zIndex, opacity: editingBlockId === block.blockId ? 0 : 1, pointerEvents: editingBlockId === block.blockId ? 'none' : 'auto' }}
      resizeHandleStyles={{
        right: { zIndex: 5 },
        bottom: { zIndex: 5 },
        bottomRight: { zIndex: 5 },
      }}
    >
      <SmartBlock
        id={block.blockId}
        type={block.type}
        content={block.content}
        language={block.language}
        url={block.url}
        width={block.width}
        height={block.height}
        x={block.x}
        y={block.y}
        isSelected={isSelected}
        isConnected={isConnected}
        onUpdateBlock={onUpdateBlock}
        onDeleteBlock={onDeleteBlock}
        onFocus={onSelectBlock}
        onAnchorMouseDown={onAnchorMouseDown}
        onAnchorMouseUp={onAnchorMouseUp}
        onDimensionsChange={onDimensionsChange}
        isConnectionDragging={isConnectionDragging}
        readOnly={readOnly}
        color={block.color}
        textColor={block.textColor}
        fontSize={liveFontSize !== null ? liveFontSize : block.fontSize}
        onEditRequest={onEditRequest}
        onMentionClick={onMentionClick}
        isUploading={block.isUploading}
        fileName={block.fileName}
        fileSize={block.fileSize}
        onResourceAdd={onResourceAdd}
        topicId={topicId}
        subjectId={subjectId}
        onRegisterHeight={onRegisterHeight}
        metadata={block.metadata}
      />
    </Rnd>
  );
};

const BlockWrapper = memo(BlockWrapperComponent, (prev, next) => {
  return (
    prev.block === next.block &&
    prev.isSelected === next.isSelected &&
    prev.isConnected === next.isConnected &&
    prev.readOnly === next.readOnly &&
    prev.isConnectionDragging === next.isConnectionDragging &&
    prev.zoom === next.zoom &&
    prev.effectiveCanvasWidth === next.effectiveCanvasWidth &&
    prev.onEditRequest === next.onEditRequest &&
    prev.editingBlockId === next.editingBlockId &&
    prev.block.fontSize === next.block.fontSize
  );
});

function CanvasBlockLayerComponent({
  blocks,
  connections,
  selectedBlockId,
  readOnly,
  onDragStop,
  onDrag,
  onDragStart,
  onUpdateBlock,
  onDeleteBlock,
  onSelectBlock,
  onDimensionsChange,
  onAnchorMouseDown,
  onAnchorMouseUp,
  isConnectionDragging,
  dragController,
  zoom,
  onEditRequest,
  editingBlockId,
  onMentionClick,
  onResourceAdd,
  topicId,
  subjectId,
  onRegisterHeight,
}: CanvasBlockLayerProps) {
  const typography = useAppStore(state => state.typography);
  const effectiveCanvasWidth = typography?.canvasWidth ?? 890;

  const connectedBlockIds = useMemo(() => {
    const set = new Set<string>();
    if (connections) {
      for (const c of connections) {
        set.add(c.fromBlock);
        set.add(c.toBlock);
      }
    }
    return set;
  }, [connections]);

  return (
    <>
      {blocks.map(block => (
        <BlockWrapper
          key={block.blockId}
          block={block}
          isSelected={block.blockId === selectedBlockId || selectedBlockId === 'ALL'}
          isConnected={connectedBlockIds.has(block.blockId)}
          readOnly={readOnly}
          onDragStop={onDragStop}
          onDrag={onDrag}
          onDragStart={onDragStart}
          onUpdateBlock={onUpdateBlock}
          onDeleteBlock={onDeleteBlock}
          onSelectBlock={onSelectBlock}
          onDimensionsChange={onDimensionsChange}
          onAnchorMouseDown={onAnchorMouseDown}
          onAnchorMouseUp={onAnchorMouseUp}
          isConnectionDragging={isConnectionDragging}
          dragController={dragController}
          zoom={zoom}
          onEditRequest={onEditRequest}
          editingBlockId={editingBlockId}
          onMentionClick={onMentionClick}
          onResourceAdd={onResourceAdd}
          topicId={topicId}
          subjectId={subjectId}
          onRegisterHeight={onRegisterHeight}
          effectiveCanvasWidth={effectiveCanvasWidth}
        />
      ))}
    </>
  );
}

export const CanvasBlockLayer = memo(CanvasBlockLayerComponent);
