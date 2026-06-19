'use client';

import React, { memo, useCallback, useMemo, useRef, useEffect} from 'react';
import { Rnd } from 'react-rnd';
import { SmartBlock } from './SmartBlock';
import { DragController } from '../rendering/DragController';
import { CanvasBlockData, Connection, CANVAS_WIDTH } from '../core/types';

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
}: BlockWrapperProps) => {
  const isResizingRef = useRef(false);

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

  const handleResizeStart = useCallback(() => {
    isResizingRef.current = true;
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleResizeStop = useCallback((_e: any, _dir: any, ref: any, _delta: any, position: any) => {
    isResizingRef.current = false;
    const newWidth = ref.offsetWidth;
    const newHeight = ref.offsetHeight;

    const updates: Partial<CanvasBlockData> = {
      width: newWidth,
      height: newHeight,
      x: position.x,
      y: position.y,
    };

    onUpdateBlock(block.blockId, updates);
  }, [block.blockId, onUpdateBlock]);

  const zIndex = isSelected ? 20 : 10;
  const isText = block.type === 'text';

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
      maxWidth={CANVAS_WIDTH - block.x - SIDE_PADDING}
      onDragStop={handleRndDragStop}
      onDrag={handleRndDrag}
      onDragStart={handleRndDragStart}
      dragHandleClassName="smart-block-drag-handle"
      enableResizing={{
        top: false, right: isText, bottom: !isText, left: false,
        topRight: false, bottomRight: !isText, bottomLeft: false, topLeft: false,
      }}
      onResizeStart={handleResizeStart}
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
        fontSize={block.fontSize}
        onEditRequest={onEditRequest}
        onMentionClick={onMentionClick}
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
}: CanvasBlockLayerProps) {
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
        />
      ))}
    </>
  );
}

export const CanvasBlockLayer = memo(CanvasBlockLayerComponent);
