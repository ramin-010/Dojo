'use client';

import { useCallback, useRef, useMemo, useState } from 'react';
import { CanvasBlockData, CANVAS_WIDTH, CANVAS_MIN_HEIGHT, GUIDE_LINE_SPACING, DEFAULT_FONT_SIZE } from './types';
import { Connection, BlockDims } from '@/types/canvas';
import { DragController } from '@/components/canvas/rendering/DragController';
import { CanvasDragStart } from '@/components/canvas/rendering/canvasTypes';
import { SIDE_PADDING, VERTICAL_PADDING } from './SingleCanvas';

export function snapToGuide(y: number): number {
  const offset = -30;
  return Math.round((y - offset) / GUIDE_LINE_SPACING) * GUIDE_LINE_SPACING + offset;
}

interface UseCanvasHandlersParams {
  canvasId: string;
  blocks: CanvasBlockData[];
  connections: Connection[];
  selectedBlockId: string | null;
  selectedConnectionId: string | null;
  isActive: boolean;
  showTitle?: boolean;
  zoom: number;

  onSelectBlock: (id: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<CanvasBlockData>) => void;
  onDeleteBlock: (blockId: string) => void;
  onAddBlock: (canvasId: string, type: CanvasBlockData['type'], x?: number, y?: number) => string;
  onCanvasClick: (canvasId: string) => void;
  onConnectionsChange: (connections: Connection[]) => void;
  onSelectConnection: (id: string | null) => void;

  containerRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
}

export interface CanvasHandlers {
  cursorKeyRef: React.MutableRefObject<string>;
  editingBlockIdRef: React.MutableRefObject<string | null>;

  cursorPos: { x: number; y: number } | null;
  editingBlockId: string | null;
  isNewBlockEditing: boolean;
  editingDims: { width: number; height: number } | null;
  isDraggingBlock: boolean;
  activeDragStart: CanvasDragStart | null;
  showCoverPicker: boolean;
  setShowCoverPicker: React.Dispatch<React.SetStateAction<boolean>>;

  editingBlockData: CanvasBlockData | null | undefined;
  editingBlockContent: string | undefined;
  computedHeight: number;
  guideLineCount: number;
  blockDims: BlockDims[];
  dragControllerInstance: DragController;

  setConnections: (updater: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  getCanvasPoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  handleDragStopWithController: (id: string, x: number, y: number) => void;
  handleDragStart: (id: string) => void;
  handleDimensionsChange: (id: string, width: number, height: number) => void;
  handleAddBlockFromMenu: (type: CanvasBlockData['type'], _x?: number, _y?: number, content?: string) => void;
  handleSingleClick: (e: React.MouseEvent) => void;
  handleCursorCommit: (html: string, dims?: { width: number; height: number }) => void;
  handleCursorDiscard: () => void;
  handleEditRequest: (blockId: string) => void;
  handlePasteAsNewBlock: (x: number, y: number, html: string) => void;
  handleDoubleClick: (e: React.MouseEvent) => void;
  handleMoveCursor: (direction: 'up' | 'down' | 'left' | 'right') => void;
  handleAnchorMouseDown: (blockId: string, side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  handleConnectionDragComplete: () => void;
  handleSelectConnectionWrapper: (id: string, _e?: React.MouseEvent) => void;

  setCursorPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setEditingBlockId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingDims: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
  setIsNewBlockEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCanvasHandlers({
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
}: UseCanvasHandlersParams): CanvasHandlers {
  const [dragControllerInstance] = useState(() => new DragController());
  const [activeDragStart, setActiveDragStart] = useState<CanvasDragStart | null>(null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isNewBlockEditing, setIsNewBlockEditing] = useState(false);
  const [editingDims, setEditingDims] = useState<{ width: number; height: number } | null>(null);

  const cursorKeyRef = useRef<string>('new-cursor');
  const editingBlockIdRef = useRef<string | null>(null);
  editingBlockIdRef.current = editingBlockId;

  const editingBlockData = useMemo(() => {
    if (!editingBlockId) return null;
    return blocks.find(b => b.blockId === editingBlockId);
  }, [editingBlockId, blocks]);

  const editingBlockContent = editingBlockData?.content;

  const setConnections = useCallback(
    (updater: Connection[] | ((prev: Connection[]) => Connection[])) => {
      if (typeof updater === 'function') {
        const next = updater(connections);
        onConnectionsChange(next);
      } else {
        onConnectionsChange(updater);
      }
    },
    [connections, onConnectionsChange]
  );

  const computedHeight = useMemo(() => {
    let maxBottom = CANVAS_MIN_HEIGHT;

    if (blocks.length > 0) {
      for (const block of blocks) {
        let blockHeight = typeof block.height === 'number' ? block.height : 200;
        if (block.blockId === editingBlockId && editingDims) {
          blockHeight = editingDims.height;
        }
        const bottom = block.y + blockHeight + 400;
        if (bottom > maxBottom) maxBottom = bottom;
      }
    }

    if (!editingBlockId && cursorPos && editingDims) {
      const bottom = cursorPos.y + editingDims.height + 300; //canvas height extend buffer
      if (bottom > maxBottom) maxBottom = bottom; 
    }

    return maxBottom;
  }, [blocks, editingBlockId, editingDims, cursorPos]);

  const guideLineCount = useMemo(() => {
    return Math.floor(computedHeight / GUIDE_LINE_SPACING);
  }, [computedHeight]);

  const blockDims: BlockDims[] = useMemo(() => {
    return blocks.map(b => {
      let h: number;
      let w: number = b.width;
      
      if (b.blockId === editingBlockId && editingDims) {
        h = editingDims.height;
        w = editingDims.width;
      } else if (typeof b.height === 'number') {
        h = b.height;
      } else {
        const el = document.getElementById(`smart-block-${b.blockId}`) || document.getElementById(b.blockId);
        h = el ? el.getBoundingClientRect().height / (zoom || 1) : 200;
      }
      return { id: b.blockId, x: b.x, y: b.y, width: w, height: h };
    });
  }, [blocks, zoom, editingBlockId, editingDims]);

  const getCanvasPoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const container = containerRef.current;
      if (!container) return { x: e.clientX, y: e.clientY };
      const rect = container.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left + container.scrollLeft) / zoom,
        y: (e.clientY - rect.top + container.scrollTop) / zoom,
      };
    },
    [zoom, containerRef]
  );

  const [isDraggingBlock, setIsDraggingBlock] = useState(false);

  const handleDragStop = useCallback(
    (id: string, x: number, y: number) => {
      setIsDraggingBlock(false);
      const block = blocks.find(b => b.blockId === id);
      const snappedY = block?.type === 'text' ? snapToGuide(y) : y;
      const headerHeight = headerRef.current?.offsetHeight || 0;
      const minY = Math.max(headerHeight, VERTICAL_PADDING);
      const clampedY = Math.max(minY, snappedY);
      const maxX = CANVAS_WIDTH - SIDE_PADDING - (block?.width || 100);
      const clampedX = Math.max(SIDE_PADDING, Math.min(x, Math.max(SIDE_PADDING, maxX)));
      onUpdateBlock(id, { x: clampedX, y: clampedY });
    },
    [onUpdateBlock, blocks, headerRef]
  );

  const handleDragStart = useCallback(
    (id: string) => {
      setIsDraggingBlock(true);
      onSelectBlock(id);
      dragControllerInstance.startDrag(id);
    },
    [onSelectBlock, dragControllerInstance]
  );

  const handleDragStopWithController = useCallback(
    (id: string, x: number, y: number) => {
      handleDragStop(id, x, y);
      dragControllerInstance.stopDrag();
    },
    [handleDragStop, dragControllerInstance]
  );

  const handleDimensionsChange = useCallback(
    (id: string, width: number, height: number) => {
      onUpdateBlock(id, { width, height });
    },
    [onUpdateBlock]
  );

  const handleAddBlockFromMenu = useCallback(
    (type: CanvasBlockData['type'], _x?: number, _y?: number, content?: string) => {
      blocks.forEach(b => {
        if (b.type === 'text' && !b.content?.trim()) {
          onDeleteBlock(b.blockId);
        }
      });
      const blockId = onAddBlock(canvasId, type);
      if (blockId && content) {
        onUpdateBlock(blockId, { content });
      }
    },
    [canvasId, onAddBlock, blocks, onDeleteBlock, onUpdateBlock]
  );

  const handleSingleClick = useCallback(
    (e: React.MouseEvent) => {
      const isPlaceholder = (e.target as HTMLElement).closest('.empty-canvas-placeholder');
      if (e.target !== containerRef.current && !isPlaceholder) return;

      blocks.forEach(b => {
        if (b.type === 'text' && !b.content?.trim()) {
          onDeleteBlock(b.blockId);
        }
      });

      onCanvasClick(canvasId);

      const hadSelection = !!selectedBlockId || !!selectedConnectionId;
      onSelectBlock('');
      onSelectConnection(null);

      if (!isActive) {
        setCursorPos(null);
        setEditingBlockId(null);
        return;
      }

      const rect = containerRef.current!.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / zoom;
      const newX = Math.max(SIDE_PADDING, Math.min(rawX, CANVAS_WIDTH - SIDE_PADDING - 50));
      const rawY = (e.clientY - rect.top) / zoom;
      const headerHeight = headerRef.current?.offsetHeight || 0;
      const minY = Math.max(headerHeight, VERTICAL_PADDING);
      const newY = Math.max(minY, snapToGuide(rawY));

      if (cursorPos) {
        setEditingBlockId(null);
        setTimeout(() => {
          cursorKeyRef.current = `cursor-${Date.now()}`;
          setIsNewBlockEditing(true);
          setCursorPos({ x: newX, y: newY });
        }, 120);
      } else if (!hadSelection) {
        cursorKeyRef.current = `cursor-${Date.now()}`;
        setIsNewBlockEditing(true);
        setEditingBlockId(null);
        setCursorPos({ x: newX, y: newY });
      } else {
        setCursorPos(null);
        setEditingBlockId(null);
      }
    },
    [canvasId, onCanvasClick, blocks, onDeleteBlock, onSelectBlock, onSelectConnection, zoom, selectedBlockId, selectedConnectionId, cursorPos, showTitle, isActive, containerRef, headerRef]
  );

  const handleCursorCommit = useCallback(
    (html: string, dims?: { width: number; height: number }) => {
      if (editingBlockId) {
        onUpdateBlock(editingBlockId, {
          content: html,
          width: dims ? dims.width + 10 : undefined,
          height: dims ? dims.height : undefined,
        });
        setEditingBlockId(null);
        setCursorPos(null);
        setEditingDims(null);
        return;
      }
      if (!cursorPos) return;
      const blockId = onAddBlock(canvasId, 'text', cursorPos.x, cursorPos.y);
      if (blockId) {
        onUpdateBlock(blockId, {
          content: html,
          width: dims ? dims.width + 10 : 300,
          height: dims ? dims.height : 'auto',
          fontSize: DEFAULT_FONT_SIZE,
        });
      }
      setCursorPos(null);
      setEditingDims(null);
    },
    [cursorPos, canvasId, onAddBlock, onUpdateBlock, editingBlockId]
  );

  const handleCursorDiscard = useCallback(() => {
    if (editingBlockId) {
      onDeleteBlock(editingBlockId);
    }
    setCursorPos(null);
    setEditingBlockId(null);
    setEditingDims(null);
  }, [editingBlockId, onDeleteBlock]);

  const handleEditRequest = useCallback((blockId: string) => {
    const block = blocks.find(b => b.blockId === blockId);
    if (block && block.type === 'text') {
      setIsNewBlockEditing(false);
      cursorKeyRef.current = blockId;
      setEditingBlockId(blockId);
      setCursorPos({ x: block.x, y: block.y });
      onSelectBlock(blockId);
    }
  }, [blocks, onSelectBlock]);

  const handlePasteAsNewBlock = useCallback((x: number, y: number, html: string) => {
    // Create a block with the clipboard HTML
    const blockId = onAddBlock(canvasId, 'text', x, y);
    if (!blockId) return;
    onUpdateBlock(blockId, { content: html });

    // Immediately open InlineCursor to edit it — Tiptap parses the HTML through its schema
    setIsNewBlockEditing(false);
    cursorKeyRef.current = blockId;
    setEditingBlockId(blockId);
    setCursorPos({ x, y });
    onSelectBlock(blockId);
  }, [canvasId, onAddBlock, onUpdateBlock, onSelectBlock]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [containerRef]
  );

  const handleMoveCursor = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!cursorPos) return;

    let newX = cursorPos.x;
    let newY = cursorPos.y;

    const STEP_X = 20;
    const STEP_Y = GUIDE_LINE_SPACING;

    if (direction === 'up') newY -= STEP_Y;
    if (direction === 'down') newY += STEP_Y;
    if (direction === 'left') newX -= STEP_X;
    if (direction === 'right') newX += STEP_X;

    const headerHeight = headerRef.current?.offsetHeight || 0;
    const minY = Math.max(headerHeight, VERTICAL_PADDING);
    const clampedY = Math.max(minY, snapToGuide(newY));
    const clampedX = Math.max(SIDE_PADDING, Math.min(newX, CANVAS_WIDTH - SIDE_PADDING - 50));

    setCursorPos({ x: clampedX, y: clampedY });

    if (editingBlockId) {
      onUpdateBlock(editingBlockId, { x: clampedX, y: clampedY });
    }
  }, [cursorPos, editingBlockId, onUpdateBlock, headerRef]);

  const handleAnchorMouseDown = useCallback(
    (blockId: string, side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => {
      const point = getCanvasPoint(e);
      setActiveDragStart({ blockId, side, startX: point.x, startY: point.y });
    },
    [getCanvasPoint]
  );

  const handleConnectionDragComplete = useCallback(() => {
    setActiveDragStart(null);
  }, []);

  const handleSelectConnectionWrapper = useCallback(
    (id: string, _e?: React.MouseEvent) => {
      onSelectConnection(id);
    },
    [onSelectConnection]
  );

  return {
    cursorKeyRef,
    editingBlockIdRef,
    cursorPos,
    editingBlockId,
    isNewBlockEditing,
    editingDims,
    isDraggingBlock,
    activeDragStart,
    showCoverPicker,
    setShowCoverPicker,
    editingBlockData,
    editingBlockContent,
    computedHeight,
    guideLineCount,
    blockDims,
    dragControllerInstance,
    setConnections,
    getCanvasPoint,
    handleDragStopWithController,
    handleDragStart,
    handleDimensionsChange,
    handleAddBlockFromMenu,
    handleSingleClick,
    handleCursorCommit,
    handleCursorDiscard,
    handleEditRequest,
    handlePasteAsNewBlock,
    handleDoubleClick,
    handleMoveCursor,
    handleAnchorMouseDown,
    handleConnectionDragComplete,
    handleSelectConnectionWrapper,
    setCursorPos,
    setEditingBlockId,
    setEditingDims,
    setIsNewBlockEditing,
  };
}
