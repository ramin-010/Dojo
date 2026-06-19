'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CanvasBlockData, GUIDE_LINE_SPACING } from './types';
import { Connection } from '@/types/canvas';
import { canvasImageStorage } from '@/lib/storage/canvasImageStorage';

export interface TopicCanvasData {
  blocks: CanvasBlockData[];
  connections: Connection[];
}

export function parseContent(raw: string | undefined): TopicCanvasData {
  if (!raw) return { blocks: [], connections: [] };

  try {
    const parsed = JSON.parse(raw);

    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      return {
        blocks: parsed.blocks,
        connections: parsed.connections || [],
      };
    }

    if (Array.isArray(parsed)) {
      return {
        blocks: parsed,
        connections: [],
      };
    }
  } catch {
    console.error('[useCanvasState] Failed to parse canvas content:', raw);
  }

  return { blocks: [], connections: [] };
}

export function useCanvasState(
  canvasId: string,
  initialContent: string | undefined,
  onChange?: (content: string) => void
) {
  const [blocks, setBlocks] = useState<CanvasBlockData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const lastContentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (initializedRef.current) return;

    const loadContent = async () => {
      const contentStr = typeof initialContent === 'string' ? initialContent : JSON.stringify(initialContent);
      const data = parseContent(contentStr);

      const hydratedBlocks = await Promise.all(
        data.blocks.map(async (block) => {
          if (block.type !== 'image' || !block.imageId) return block;

          if (block.isUploaded && block.url && !block.url.startsWith('blob:') 
              && block.url !== 'PENDING_UPLOAD' && block.url !== 'IDB_IMAGE') {
            return block;
          }

          // We must regenerate the blob URL because it expires on page reload

          try {
            const blob = await canvasImageStorage.getImage(block.imageId);
            if (blob) {
              return { ...block, url: canvasImageStorage.createObjectURL(blob) };
            }
          } catch (err) {
            console.error('[useCanvasState] Failed to hydrate image:', block.imageId, err);
          }
          return block;
        })
      );

      skipNextOnChangeRef.current = true;

      setBlocks(hydratedBlocks);
      setConnections(data.connections);
      
      initializedRef.current = true;
      lastContentRef.current = contentStr;
    };

    loadContent();
  }, [initialContent]);

  const hydrate = useCallback(async (content: string) => {
    const data = parseContent(content);
    
    const hydratedBlocks = await Promise.all(
      data.blocks.map(async (block) => {
        if (block.type !== 'image' || !block.imageId) return block;

        if (block.isUploaded && block.url && !block.url.startsWith('blob:') 
            && block.url !== 'PENDING_UPLOAD' && block.url !== 'IDB_IMAGE') {
          return block;
        }

        // We must regenerate the blob URL because it expires on page reload

        try {
          const blob = await canvasImageStorage.getImage(block.imageId);
          if (blob) {
            return { ...block, url: canvasImageStorage.createObjectURL(blob) };
          }
        } catch (err) {}
        return block;
      })
    );

    setBlocks(hydratedBlocks);
    setConnections(data.connections);
    lastContentRef.current = content;

    skipNextOnChangeRef.current = true;
  }, []);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const skipNextOnChangeRef = useRef(true);

  useEffect(() => {
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      return;
    }
    const json = JSON.stringify({ blocks, connections } as TopicCanvasData);
    onChangeRef.current?.(json);
  }, [blocks, connections]);

  const addBlock = useCallback((targetCanvasId: string, type: CanvasBlockData['type'], x?: number, y?: number) => {
    const defaults: Record<string, Partial<CanvasBlockData>> = {
      text: { width: 450, height: 'auto', content: '' },
      code: { width: 450, height: 300, content: '// Start typing your code...\n' },
      image: { width: 300, height: 'auto', content: '' },
      embed: { width: 400, height: 160, content: '' },
    };
    const d = defaults[type] || defaults.text;

    let finalY = y;
    if (finalY === undefined) {
      finalY = 40;
      if (type === 'text') {
        const offset = -19;
        finalY = Math.round((finalY - offset) / GUIDE_LINE_SPACING) * GUIDE_LINE_SPACING + offset;
      }
    }

    const newBlock: CanvasBlockData = {
      blockId: uuidv4(),
      type,
      content: d.content || '',
      x: x ?? 40,
      y: finalY,
      width: d.width || 300,
      height: d.height || 'auto',
    };

    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.blockId);
    return newBlock.blockId;
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<CanvasBlockData>) => {
    setBlocks(prev => prev.map(b => b.blockId === blockId ? { ...b, ...updates } : b));
  }, []);

  const shiftBlocksY = useCallback((deltaY: number) => {
    if (deltaY === 0) return;
    setBlocks(prev => prev.map(b => 
      ({ ...b, y: Math.max(0, b.y + deltaY) })
    ));
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      const block = prev.find(b => b.blockId === blockId);
      if (block?.type === 'image' && block.imageId) {
        canvasImageStorage.deleteImage(block.imageId).catch(err =>
          console.error(`[useCanvasState] Failed to delete image ${block.imageId}:`, err)
        );
        if (block.url?.startsWith('blob:')) {
          URL.revokeObjectURL(block.url);
        }
      }
      return prev.filter(b => b.blockId !== blockId);
    });
    setSelectedBlockId(prev => prev === blockId ? null : prev);

    setConnections(prev => prev.filter(c => c.fromBlock !== blockId && c.toBlock !== blockId));
  }, []);

  return {
    blocks,
    connections,
    selectedBlockId,
    selectedConnectionId,
    setSelectedBlockId,
    setSelectedConnectionId,
    setBlocks,
    setConnections,
    hydrate,
    addBlock,
    updateBlock,
    deleteBlock,
    shiftBlocksY,

    addImageBlock: useCallback(async (targetCanvasId: string, file: File, x: number = 40, y: number = 40) => {
      const imageId = uuidv4();
      try {
        await canvasImageStorage.storeImage(imageId, file);
      } catch (err) {
        console.error('[useCanvasState] Failed to store image:', err);
        return null;
      }
      const blobUrl = URL.createObjectURL(file);

      const dimensions = await new Promise<{ width: number, height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
          resolve({ width: 400, height: 300 });
        };
        img.src = blobUrl;
      });

      let finalWidth = dimensions.width;
      let finalHeight = dimensions.height;
      const MAX_WIDTH = 400;
      if (finalWidth > MAX_WIDTH) {
        finalHeight = Math.round((MAX_WIDTH / finalWidth) * finalHeight);
        finalWidth = MAX_WIDTH;
      }

      const blockId = uuidv4();
      const newBlock: CanvasBlockData = {
        blockId,
        type: 'image',
        content: '',
        url: blobUrl,
        imageId,
        isUploaded: false,
        x,
        y,
        width: finalWidth,
        height: finalHeight,
      };
      setBlocks(prev => [...prev, newBlock]);
      setSelectedBlockId(blockId);
      return blockId;
    }, []),
  };
}
