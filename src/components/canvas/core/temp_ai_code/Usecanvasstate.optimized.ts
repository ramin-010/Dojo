// 'use client';

// import { useState, useCallback, useRef, useEffect } from 'react';
// import { v4 as uuidv4 } from 'uuid';
// import { CanvasBlockData, GUIDE_LINE_SPACING } from './types';
// import { Connection } from '@/types/canvas';
// import { uploadToCloud } from '@/lib/utils/upload';
// import { toast } from 'sonner';

// export interface TopicCanvasData {
//   blocks: CanvasBlockData[];
//   connections: Connection[];
// }

// export function parseContent(raw: string | undefined): TopicCanvasData {
//   if (!raw) return { blocks: [], connections: [] };
//   try {
//     const parsed = JSON.parse(raw);
//     if (parsed.blocks && Array.isArray(parsed.blocks)) {
//       return { blocks: parsed.blocks, connections: parsed.connections || [] };
//     }
//     if (Array.isArray(parsed)) {
//       return { blocks: parsed, connections: [] };
//     }
//   } catch {
//     console.error('[useCanvasState] Failed to parse canvas content:', raw);
//   }
//   return { blocks: [], connections: [] };
// }

// export function useCanvasState(
//   canvasId: string,
//   initialContent: string | undefined,
//   onChange?: (content: string) => void,
//   onBlockRemoved?: (block: CanvasBlockData) => void,
//   onResourceAdded?: (resource: any) => void
// ) {
//   const [blocks, setBlocks] = useState<CanvasBlockData[]>([]);
//   const [connections, setConnections] = useState<Connection[]>([]);
//   const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
//   const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

//   const initializedRef = useRef(false);
//   const lastContentRef = useRef<string | undefined>(undefined);

//   // ── OPTIMIZATION: Debounced serialization ref ──────────────────────────────
//   // JSON.stringify on a 200KB+ HTML string is expensive. We defer it so that
//   // rapid-fire state changes (e.g. block moves) don't serialize on every frame.
//   const serializeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

//   useEffect(() => {
//     if (initializedRef.current) return;
//     const contentStr =
//       typeof initialContent === 'string'
//         ? initialContent
//         : JSON.stringify(initialContent);
//     const data = parseContent(contentStr);
//     skipNextOnChangeRef.current = true;
//     setBlocks(data.blocks);
//     setConnections(data.connections);
//     initializedRef.current = true;
//     lastContentRef.current = contentStr;
//   }, [initialContent]);

//   const hydrate = useCallback(async (content: string) => {
//     const data = parseContent(content);
//     // ── OPTIMIZATION: Set skip flag BEFORE calling setState so the subsequent
//     // useEffect sees it as true when it runs. Previously it was set after,
//     // creating a race condition in concurrent mode.
//     skipNextOnChangeRef.current = true;
//     setBlocks(data.blocks);
//     setConnections(data.connections);
//     lastContentRef.current = content;
//   }, []);

//   const onChangeRef = useRef(onChange);
//   useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

//   const skipNextOnChangeRef = useRef(true);

//   useEffect(() => {
//     if (skipNextOnChangeRef.current) {
//       skipNextOnChangeRef.current = false;
//       return;
//     }

//     // ── OPTIMIZATION: Debounce the JSON.stringify + onChange call.
//     // With Solution 2 (BlockEditor decoupled), this effect rarely fires during
//     // typing at all. But for block moves/resizes it prevents serializing on
//     // every animation frame.
//     if (serializeTimerRef.current) clearTimeout(serializeTimerRef.current);
//     serializeTimerRef.current = setTimeout(() => {
//       const json = JSON.stringify({ blocks, connections } as TopicCanvasData);
//       onChangeRef.current?.(json);
//     }, 400);

//     return () => {
//       if (serializeTimerRef.current) clearTimeout(serializeTimerRef.current);
//     };
//   }, [blocks, connections]);

//   // ── OPTIMIZATION: Preserve object identity on update ──────────────────────
//   // The original prev.map(b => ...) created NEW object references for every
//   // block in the array on every update, defeating React.memo on BlockWrapper.
//   // This version uses slice() + index assignment so only the changed block gets
//   // a new reference. All other blocks retain the exact same object identity,
//   // so BlockWrapper's memo comparison (prev.block === next.block) passes for them.
//   const updateBlock = useCallback(
//     (blockId: string, updates: Partial<CanvasBlockData>) => {
//       setBlocks(prev => {
//         const idx = prev.findIndex(b => b.blockId === blockId);
//         if (idx === -1) return prev;

//         const current = prev[idx];
//         const updated = { ...current, ...updates };

//         // Bail out entirely if nothing actually changed value-wise.
//         // This handles the case where ResizeObserver reports the same dimensions.
//         const hasChange = (
//           Object.keys(updates) as (keyof CanvasBlockData)[]
//         ).some(k => current[k] !== updated[k]);
//         if (!hasChange) return prev;

//         const next = prev.slice(); // shallow-copy array only, not elements
//         next[idx] = updated;       // only this element gets a new reference
//         return next;
//       });
//     },
//     []
//   );

//   const addBlock = useCallback(
//     (
//       targetCanvasId: string,
//       type: CanvasBlockData['type'],
//       x?: number,
//       y?: number
//     ) => {
//       const defaults: Record<string, Partial<CanvasBlockData>> = {
//         text: { width: 450, height: 'auto', content: '' },
//         code: { width: 450, height: 300, content: '// Start typing your code...\n' },
//         image: { width: 300, height: 'auto', content: '' },
//         embed: { width: 400, height: 160, content: '' },
//       };
//       const d = defaults[type] || defaults.text;

//       let finalY = y;
//       if (finalY === undefined) {
//         finalY = 40;
//         if (type === 'text') {
//           const offset = -19;
//           finalY =
//             Math.round((finalY - offset) / GUIDE_LINE_SPACING) *
//               GUIDE_LINE_SPACING +
//             offset;
//         }
//       }

//       const newBlock: CanvasBlockData = {
//         blockId: uuidv4(),
//         type,
//         content: d.content || '',
//         x: x ?? 40,
//         y: finalY,
//         width: d.width || 300,
//         height: d.height || 'auto',
//       };

//       setBlocks(prev => [...prev, newBlock]);
//       setSelectedBlockId(newBlock.blockId);
//       return newBlock.blockId;
//     },
//     []
//   );

//   const shiftBlocksY = useCallback((deltaY: number) => {
//     if (deltaY === 0) return;
//     setBlocks(prev =>
//       prev.map(b => ({ ...b, y: Math.max(0, b.y + deltaY) }))
//     );
//   }, []);

//   const deleteBlock = useCallback(
//     (blockId: string) => {
//       setBlocks(prev => {
//         const block = prev.find(b => b.blockId === blockId);
//         if (block) {
//           if (block.type === 'image' && block.url?.startsWith('blob:')) {
//             URL.revokeObjectURL(block.url);
//           }
//           if (
//             (block.type === 'image' || block.type === 'file') &&
//             block.url &&
//             !block.url.startsWith('blob:')
//           ) {
//             setTimeout(() => onBlockRemoved?.(block), 0);
//           }
//         }
//         return prev.filter(b => b.blockId !== blockId);
//       });
//       setSelectedBlockId(prev => (prev === blockId ? null : prev));
//       setConnections(prev =>
//         prev.filter(c => c.fromBlock !== blockId && c.toBlock !== blockId)
//       );
//     },
//     [onBlockRemoved]
//   );

//   return {
//     blocks,
//     connections,
//     selectedBlockId,
//     selectedConnectionId,
//     setSelectedBlockId,
//     setSelectedConnectionId,
//     setBlocks,
//     setConnections,
//     hydrate,
//     addBlock,
//     updateBlock,
//     deleteBlock,
//     shiftBlocksY,

//     addImageBlock: useCallback(
//       async (
//         targetCanvasId: string,
//         file: File,
//         x: number = 40,
//         y: number = 40
//       ) => {
//         const imageId = uuidv4();
//         const blobUrl = URL.createObjectURL(file);

//         const dimensions = await new Promise<{ width: number; height: number }>(
//           resolve => {
//             const img = new Image();
//             img.onload = () => resolve({ width: img.width, height: img.height });
//             img.onerror = () => resolve({ width: 400, height: 300 });
//             img.src = blobUrl;
//           }
//         );

//         let finalWidth = dimensions.width;
//         let finalHeight = dimensions.height;
//         const MAX_WIDTH = 400;
//         if (finalWidth > MAX_WIDTH) {
//           finalHeight = Math.round((MAX_WIDTH / finalWidth) * finalHeight);
//           finalWidth = MAX_WIDTH;
//         }

//         const blockId = uuidv4();
//         const newBlock: CanvasBlockData = {
//           blockId,
//           type: 'image',
//           content: '',
//           url: '',
//           imageId,
//           isUploading: true,
//           x,
//           y,
//           width: finalWidth,
//           height: finalHeight,
//         };

//         setBlocks(prev => [...prev, newBlock]);
//         setSelectedBlockId(blockId);
//         URL.revokeObjectURL(blobUrl);

//         uploadToCloud(file, imageId, targetCanvasId)
//           .then(result => {
//             // ── OPTIMIZATION: updateBlock handles identity preservation ──
//             setBlocks(prev => {
//               const idx = prev.findIndex(b => b.blockId === blockId);
//               if (idx === -1) return prev;
//               const next = prev.slice();
//               next[idx] = { ...prev[idx], url: result.url, isUploading: false };
//               return next;
//             });
//             if (result.resource) {
//               onResourceAdded?.(result.resource);
//             }
//           })
//           .catch(err => {
//             console.error('[useCanvasState] Image upload failed:', err);
//             setBlocks(prev => prev.filter(b => b.blockId !== blockId));
//           });

//         return blockId;
//       },
//       [onResourceAdded]
//     ),

//     addFileBlock: useCallback(
//       async (
//         targetCanvasId: string,
//         file: File,
//         x: number = 40,
//         y: number = 40
//       ) => {
//         const fileId = uuidv4();
//         const toastId = toast.loading(`Uploading ${file.name}...`);
//         if (typeof window !== 'undefined') {
//           window.dispatchEvent(
//             new CustomEvent('canvas-drag-state', { detail: { isDragging: true } })
//           );
//         }
//         uploadToCloud(file, fileId, targetCanvasId)
//           .then(result => {
//             toast.success(`File saved to resources tab`, { id: toastId });
//             if (result.resource) onResourceAdded?.(result.resource);
//           })
//           .catch(err => {
//             console.error('[useCanvasState] File upload failed:', err);
//             toast.error(`Failed to upload ${file.name}`, { id: toastId });
//           })
//           .finally(() => {
//             if (typeof window !== 'undefined') {
//               window.dispatchEvent(
//                 new CustomEvent('canvas-drag-state', {
//                   detail: { isDragging: false },
//                 })
//               );
//             }
//           });
//         return '';
//       },
//       [onResourceAdded]
//     ),
//   };
// }