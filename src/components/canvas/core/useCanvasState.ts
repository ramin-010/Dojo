 'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CanvasBlockData, GUIDE_LINE_SPACING } from './types';
import { Connection } from '@/types/canvas';
import { uploadToCloud } from '@/lib/utils/upload';
import { toast } from 'sonner';

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
  initialContent?: string,
  onChange?: () => void,
  onBlockRemoved?: (block: any) => void,
  onResourceAdded?: (resource: any) => void
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

      skipNextOnChangeRef.current = true;
      setBlocks(data.blocks);
      setConnections(data.connections);
      
      initializedRef.current = true;
      lastContentRef.current = contentStr;
    };

    loadContent();
  }, [initialContent]);

  const hydrate = useCallback(async (content: string) => {
    const data = parseContent(content);
    
    setBlocks(data.blocks);
    setConnections(data.connections);
    lastContentRef.current = content;

    skipNextOnChangeRef.current = true;
  }, []);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const skipNextOnChangeRef = useRef(true);

  // Notify parent on state change without stringifying
  useEffect(() => {
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      return;
    }
    onChangeRef.current?.();
  }, [blocks, connections]);

  // Listen for AI block insertions
  useEffect(() => {
    const handleInsertAiBlock = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newBlock = customEvent.detail.block;
      if (!newBlock) return;

      setBlocks(prev => {
        // Find the lowest block on the canvas to place the new one below it
        let maxY = 40;
        if (prev.length > 0) {
          prev.forEach(b => {
            const blockHeight = typeof b.height === 'number' ? b.height : 800; // rough estimate if auto
            const bottom = b.y + blockHeight;
            if (bottom > maxY) maxY = bottom;
          });
          maxY += 80; // Add some padding
        }
        
        const blockToInsert = {
          ...newBlock,
          blockId: uuidv4(), // Force a unique ID to prevent React key collisions
          y: maxY,
          x: 40 // Align left
        };

        return [...prev, blockToInsert];
      });
    };

    window.addEventListener('CANVAS_INSERT_AI_BLOCK', handleInsertAiBlock);
    return () => window.removeEventListener('CANVAS_INSERT_AI_BLOCK', handleInsertAiBlock);
  }, []);

  // Event Bus for AI Command Bar Tagging
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('CANVAS_SELECTION_CHANGED', { detail: { selectedBlockId } }));
    
    const handleRequestSelection = () => {
      window.dispatchEvent(new CustomEvent('CANVAS_SELECTION_CHANGED', { detail: { selectedBlockId } }));
    };
    window.addEventListener('REQUEST_CANVAS_SELECTION', handleRequestSelection);
    return () => window.removeEventListener('REQUEST_CANVAS_SELECTION', handleRequestSelection);
  }, [selectedBlockId]);

  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    const handleBlockRequest = (e: any) => {
      const ids = new Set(e.detail.blockIds);
      const requestedBlocks = blocksRef.current.filter(b => ids.has(b.blockId));
      window.dispatchEvent(new CustomEvent('RESPONSE_BLOCK_DATA', { detail: { blocks: requestedBlocks } }));
    };
    window.addEventListener('REQUEST_BLOCK_DATA', handleBlockRequest);
    return () => window.removeEventListener('REQUEST_BLOCK_DATA', handleBlockRequest);
  }, []);

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
      if (block) {
        if (block.type === 'image' && block.url?.startsWith('blob:')) {
          URL.revokeObjectURL(block.url);
        }
        if ((block.type === 'image' || block.type === 'file') && block.url && !block.url.startsWith('blob:')) {
          setTimeout(() => onBlockRemoved?.(block), 0);
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
        url: '', // Skeleton loader until uploaded
        imageId,
        isUploading: true,
        x,
        y,
        width: finalWidth,
        height: finalHeight,
      };
      
      setBlocks(prev => [...prev, newBlock]);
      setSelectedBlockId(blockId);
      URL.revokeObjectURL(blobUrl);

      // Start asynchronous upload
      uploadToCloud(file, imageId, targetCanvasId).then(result => {
        setBlocks(prev => prev.map(b => b.blockId === blockId ? { 
          ...b, 
          url: result.url, 
          isUploading: false 
        } : b));
        if (result.resource) {
          onResourceAdded?.(result.resource);
        }
      }).catch(err => {
        console.error('[useCanvasState] Image upload failed:', err);
        // On error, remove the block or show error state. Removing for now.
        setBlocks(prev => prev.filter(b => b.blockId !== blockId));
      });

      return blockId;
    }, [onResourceAdded]),

    addFileBlock: useCallback(async (targetCanvasId: string, file: File, x: number = 40, y: number = 40) => {
      const fileId = uuidv4();
      const toastId = toast.loading(`Uploading ${file.name}...`);

      // Show canvas border while uploading
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('canvas-upload-state', { detail: { isUploading: true } }));
      }

      // Start asynchronous upload
      uploadToCloud(file, fileId, targetCanvasId).then(result => {
        toast.success(`File saved to resources tab`, { id: toastId });
        if (result.resource) {
          onResourceAdded?.(result.resource);
        }
      }).catch(err => {
        console.error('[useCanvasState] File upload failed:', err);
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }).finally(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('canvas-upload-state', { detail: { isUploading: false } }));
        }
      });

      // No block is created on the canvas for standard files
      return '';
    }, [onResourceAdded]),
  };
}


