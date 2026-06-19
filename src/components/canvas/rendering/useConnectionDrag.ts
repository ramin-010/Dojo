import { useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DraftConnection } from './canvasTypes';
import { Connection, BlockDims } from '@/types/canvas';

export const SNAP_RADIUS = 20;

const getAnchorPosition = (block: BlockDims, side: 'top' | 'right' | 'bottom' | 'left'): { x: number, y: number } => {
  const { x, y, width: w, height: h } = block;
  
  switch (side) {
    case 'top': return { x: x + w / 2, y: y };
    case 'right': return { x: x + w, y: y + h / 2 };
    case 'bottom': return { x: x + w / 2, y: y + h };
    case 'left': return { x: x, y: y + h / 2 };
  }
};

export const useConnectionDrag = (
  draftConnection: DraftConnection | null,
  setDraftConnection: React.Dispatch<React.SetStateAction<DraftConnection | null>>,
  getCanvasPoint: (e: { clientX: number; clientY: number }) => { x: number; y: number },
  blocks: BlockDims[],
  connections: Connection[],
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>
) => {
  const snappedAnchorRef = useRef<{ blockId: string, side: 'top' | 'right' | 'bottom' | 'left' } | null>(null);
  const lastMoveTimeRef = useRef<number>(0);
  const moveTimeoutRef = useRef<any>(null);
  
  const draftConnectionRef = useRef(draftConnection);
  useEffect(() => {
    draftConnectionRef.current = draftConnection;
  }, [draftConnection]);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  const isDragging = !!draftConnection;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = null;
      }

      const now = Date.now();
      const timeSinceLast = now - lastMoveTimeRef.current;

      const performUpdate = () => {
        const currentDraft = draftConnectionRef.current;
        if (!currentDraft) return;
        
        lastMoveTimeRef.current = Date.now();
        const { x, y } = getCanvasPoint(e);
        
        let closestAnchor: { blockId: string; side: 'top' | 'right' | 'bottom' | 'left'; x: number; y: number } | null = null;
        let minDist = SNAP_RADIUS;

        const currentBlocks = blocksRef.current;
        const currentConnections = connectionsRef.current;

        for (const block of currentBlocks) {
          if (block.id === currentDraft.fromBlock) continue;

          const sides = ['top', 'right', 'bottom', 'left'] as const;
          for (const side of sides) {
            const isOutgoingSource = currentConnections.some(c => 
               c.fromBlock === block.id && c.fromSide === side && !c.hidden
            );
            
            if (isOutgoingSource) continue;

            const pos = getAnchorPosition(block, side);
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            
            if (dist < minDist) {
              minDist = dist;
              closestAnchor = { blockId: block.id, side, x: pos.x, y: pos.y };
            }
          }
        }

        if (closestAnchor) {
          const anchor = closestAnchor; 
          snappedAnchorRef.current = { blockId: anchor.blockId, side: anchor.side };
          
          setDraftConnection(prev => {
             if (!prev) return null;
             return { ...prev, currentX: anchor.x, currentY: anchor.y };
          });
        } else {
          snappedAnchorRef.current = null;
          setDraftConnection(prev => prev ? ({ ...prev, currentX: x, currentY: y }) : null);
        }
      };

      if (timeSinceLast >= 24) {
        performUpdate();
      } else {
        moveTimeoutRef.current = setTimeout(performUpdate, 24 - timeSinceLast);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const currentDraft = draftConnectionRef.current;
      if (currentDraft) {
        if (snappedAnchorRef.current) {
          const { blockId, side } = snappedAnchorRef.current;
          
          const currentConnections = connectionsRef.current;
           const isOutgoingSource = currentConnections.some(c => 
             c.fromBlock === blockId && c.fromSide === side && !c.hidden
          );

          if (!isOutgoingSource) {
            setConnections(prev => [...prev, {
              id: uuidv4(),
              fromBlock: currentDraft.fromBlock,
              fromSide: currentDraft.fromSide,
              toBlock: blockId,
              toSide: side
            }]);
          }
        }
        setDraftConnection(null);
        snappedAnchorRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, [isDragging, getCanvasPoint, setDraftConnection, setConnections]);
};
