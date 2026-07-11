import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Connection, BlockDims } from '@/types/canvas';
import { DragController } from './DragController';
import { calculateConnectionPath, calculatePathFromRects, BlockRect } from './connectionGeometry';

interface NativeConnectionLayerProps {
    connections: Connection[];
    blocks: BlockDims[]; 
    dragController?: DragController | null;
    selectedConnectionId: string | null;
    onSelectConnection: (id: string, e: React.MouseEvent) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    zoom: number;
}

export const NativeConnectionLayer: React.FC<NativeConnectionLayerProps> = ({
    connections,
    blocks,
    dragController,
    selectedConnectionId,
    onSelectConnection,
    containerRef,
    zoom
}) => {
    const connectionsRef = useRef(connections);
    const blocksRef = useRef(blocks);
    const zoomRef = useRef(zoom);
    
    useEffect(() => { connectionsRef.current = connections; }, [connections]);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);
    useEffect(() => { zoomRef.current = zoom; }, [zoom]);

    useLayoutEffect(() => {
        const containerEl = containerRef.current;
        if (!containerEl || connections.length === 0) return;

        const elToRect = (el: Element, contRect: DOMRect): BlockRect => {
            const r = el.getBoundingClientRect();
            const idMatch = el.id.match(/(?:smart-block-)?(.+)/);
            const id = idMatch ? idMatch[1] : el.id;
            const b = blocksRef.current.find(b => b.id === id);

            return {
                x: b ? b.x : (r.left - contRect.left + containerEl.scrollLeft) / zoomRef.current,
                y: b ? b.y : (r.top - contRect.top + containerEl.scrollTop) / zoomRef.current,
                width: r.width / zoomRef.current,
                height: r.height / zoomRef.current,
            };
        };

        const updatePaths = () => {
            const contRect = containerEl.getBoundingClientRect();
            
            connections.filter(conn => !conn.hidden).forEach(conn => {
                // Ignore connections attached to the currently dragged block
                if (dragController?.isDragging && dragController.activeId) {
                    if (conn.fromBlock === dragController.activeId || conn.toBlock === dragController.activeId) {
                        return;
                    }
                }

                // Fix 1b: getElementById O(1) instead of querySelector attribute selector O(n)
                const fromEl = document.getElementById(`smart-block-${conn.fromBlock}`) || document.getElementById(conn.fromBlock);
                const toEl = document.getElementById(`smart-block-${conn.toBlock}`) || document.getElementById(conn.toBlock);
                if (!fromEl || !toEl) return;
                
                const newPath = calculatePathFromRects(conn, elToRect(fromEl, contRect), elToRect(toEl, contRect));
                const pathEl = document.getElementById(`conn-path-${conn.id}`);
                if (pathEl) pathEl.setAttribute('d', newPath);
            });
        };
        
        let rafId = requestAnimationFrame(updatePaths);

        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(updatePaths);
        });

        observer.observe(containerEl);

        const blockIdsToObserve = new Set<string>();
        connections.filter(c => !c.hidden).forEach(c => {
            blockIdsToObserve.add(c.fromBlock);
            blockIdsToObserve.add(c.toBlock);
        });

        blockIdsToObserve.forEach(id => {
            const el = document.getElementById(`smart-block-${id}`) || document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => {
            cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [connections, blocks, zoom, containerRef]);

    useEffect(() => {
        const containerEl = containerRef.current;
        if (!containerEl || connections.length === 0) return;

        const elToRect = (el: Element, contRect: DOMRect): BlockRect => {
            const r = el.getBoundingClientRect();
            const idMatch = el.id.match(/(?:smart-block-)?(.+)/);
            const id = idMatch ? idMatch[1] : el.id;
            const b = blocks.find(b => b.id === id);
            return {
                x: b ? b.x : (r.left - contRect.left + containerEl.scrollLeft) / zoom,
                y: b ? b.y : (r.top - contRect.top + containerEl.scrollTop) / zoom,
                width: r.width / zoom,
                height: r.height / zoom,
            };
        };

        const updatePaths = () => {
            const contRect = containerEl.getBoundingClientRect();
            connections.filter(conn => !conn.hidden).forEach(conn => {
                const fromEl = document.getElementById(`smart-block-${conn.fromBlock}`) || document.getElementById(conn.fromBlock);
                const toEl = document.getElementById(`smart-block-${conn.toBlock}`) || document.getElementById(conn.toBlock);
                if (!fromEl || !toEl) return;
                const newPath = calculatePathFromRects(conn, elToRect(fromEl, contRect), elToRect(toEl, contRect));
                const pathEl = document.getElementById(`conn-path-${conn.id}`);
                if (pathEl) pathEl.setAttribute('d', newPath);
            });
        };

        const t1 = setTimeout(() => requestAnimationFrame(updatePaths), 50);
        const t2 = setTimeout(() => requestAnimationFrame(updatePaths), 150);
        const t3 = setTimeout(() => requestAnimationFrame(updatePaths), 350);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [zoom, connections, containerRef]);

    useEffect(() => {
        if (!dragController) return;

        let rafId: number;
        let isActive = false;
        
        // Cache for static block geometries during drag
        let staticGeos = new Map<string, BlockRect>();
        // Fix 1c: Cache the active block's dimensions at drag start — never read from DOM during RAF
        let activeBlockDims = { width: 200, height: 200 };

        const updateLoop = () => {
            if (!isActive) return;
            
            // Always schedule the next frame FIRST, so the loop never dies
            rafId = requestAnimationFrame(updateLoop);
            
            const activeId = dragController.activeId;
            if (!activeId) return;

            const currentConnections = connectionsRef.current;
            
            if (dragController.activeOffset) {
                const { x, y } = dragController.activeOffset;
                // Fix 1c: Read dimensions from the cache, not from the DOM
                const activeBlockGeo: BlockRect = { x, y, width: activeBlockDims.width, height: activeBlockDims.height };

                currentConnections.forEach(conn => {
                    if (conn.hidden) return;
                    if (conn.fromBlock !== activeId && conn.toBlock !== activeId) return;

                    const isFromMoving = conn.fromBlock === activeId;
                    
                    let fromGeo = isFromMoving ? activeBlockGeo : staticGeos.get(conn.fromBlock);
                    let toGeo = !isFromMoving ? activeBlockGeo : staticGeos.get(conn.toBlock);

                    if (fromGeo && toGeo) {
                        const newPath = calculatePathFromRects(conn, fromGeo, toGeo);
                        const pathEl = document.getElementById(`conn-path-${conn.id}`);
                        if (pathEl) pathEl.setAttribute('d', newPath);
                    }
                });
            }
        };

        const unsubscribe = dragController.subscribe((isDragging) => {
            if (isDragging) {
                const activeId = dragController.activeId;
                if (!activeId) return;

                // Fix 1c: Check if the dragged block has ANY connections before scheduling RAF
                const currentConnections = connectionsRef.current;
                const hasConnections = currentConnections.some(
                    conn => !conn.hidden && (conn.fromBlock === activeId || conn.toBlock === activeId)
                );
                if (!hasConnections) return; // Skip RAF loop entirely — nothing to update

                isActive = true;
                
                // Cache geometries of all connected blocks
                staticGeos.clear();
                const containerEl = containerRef.current;
                if (containerEl) {
                    const contRect = containerEl.getBoundingClientRect();
                    const currentZoom = zoomRef.current;
                    const elToRect = (el: Element): BlockRect => {
                        const r = el.getBoundingClientRect();
                        const idMatch = el.id.match(/(?:smart-block-)?(.+)/);
                        const id = idMatch ? idMatch[1] : el.id;
                        const b = blocksRef.current.find(b => b.id === id);
                        return {
                            x: b ? b.x : (r.left - contRect.left + containerEl.scrollLeft) / currentZoom,
                            y: b ? b.y : (r.top - contRect.top + containerEl.scrollTop) / currentZoom,
                            width: r.width / currentZoom,
                            height: r.height / currentZoom,
                        };
                    };

                    // Fix 1c: Cache the active block's dimensions ONCE at drag start
                    const activeBlockEl = document.getElementById(`smart-block-${activeId}`) || document.getElementById(activeId);
                    if (activeBlockEl) {
                        activeBlockDims = {
                            width: (activeBlockEl as HTMLElement).offsetWidth || 200,
                            height: (activeBlockEl as HTMLElement).offsetHeight || 200,
                        };
                    }
                    
                    currentConnections.forEach(conn => {
                        if (conn.hidden) return;
                        if (conn.fromBlock === activeId || conn.toBlock === activeId) {
                            const staticId = conn.fromBlock === activeId ? conn.toBlock : conn.fromBlock;
                            if (!staticGeos.has(staticId)) {
                                const el = document.getElementById(`smart-block-${staticId}`) || document.getElementById(staticId);
                                if (el) {
                                    staticGeos.set(staticId, elToRect(el));
                                } else {
                                    const b = blocksRef.current.find(b => b.id === staticId);
                                    if (b) staticGeos.set(staticId, { x: b.x, y: b.y, width: b.width, height: b.height });
                                }
                            }
                        }
                    });
                }

                rafId = requestAnimationFrame(updateLoop);
            } else {
                isActive = false;
                staticGeos.clear();
                cancelAnimationFrame(rafId);
            }
        });

        return () => {
            unsubscribe();
            cancelAnimationFrame(rafId);
        };
    }, [dragController, containerRef]); 

    const visibleConnections = connections.filter(conn => !conn.hidden);

    if (visibleConnections.length === 0) {
        return null;
    }

    const endpointIds = new Set(visibleConnections.flatMap(c => [c.fromBlock, c.toBlock]));

    return (
        <svg 
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', zIndex: 0 }}
        >
            <defs>
                 <marker 
                     id="arrowhead" 
                     markerWidth="14" 
                     markerHeight="14" 
                     refX="14" 
                     refY="7" 
                     orient="auto"
                     markerUnits="userSpaceOnUse"
                 >
                     <polygon points="0 0, 16 7, 0 14" fill="context-stroke" />
                 </marker>
             </defs>
            {(() => {
                let renderBlocks = blocks;
                const containerEl = containerRef.current;
                
                if (containerEl) {
                    renderBlocks = blocks.map(b => {
                        let newB = { ...b };
                        
                        // Sync live dimensions from DOM for endpoint blocks
                        if (endpointIds.has(b.id)) {
                            const el = document.getElementById(`smart-block-${b.id}`) || document.getElementById(b.id);
                            if (el) {
                                const r = el.getBoundingClientRect();
                                newB.width = r.width / zoom;
                                newB.height = r.height / zoom;
                            }
                        }
                        
                        // Sync live drag position
                        if (dragController?.isDragging && dragController.activeId === b.id && dragController.activeOffset) {
                            newB.x = dragController.activeOffset.x;
                            newB.y = dragController.activeOffset.y;
                        }
                        
                        return newB;
                    });
                }
                
                return connections.filter(conn => !conn.hidden).map(conn => {
                    const isSelected = selectedConnectionId === conn.id;
                    
                    // During the transitional frame (drag just started, activeOffset still null),
                    // react-rnd is mid-DOM-manipulation so getBoundingClientRect() returns wrong values.
                    // Preserve the existing correct path from the DOM instead of recomputing a bad one.
                    const isTransitionalFrame = dragController?.isDragging && 
                        dragController.activeId && 
                        !dragController.activeOffset &&
                        (conn.fromBlock === dragController.activeId || conn.toBlock === dragController.activeId);
                    
                    let path: string;
                    if (isTransitionalFrame) {
                        const existingPathEl = document.getElementById(`conn-path-${conn.id}`);
                        path = existingPathEl?.getAttribute('d') || calculateConnectionPath(conn, renderBlocks);
                    } else {
                        path = calculateConnectionPath(conn, renderBlocks);
                    }
                    
                    return (
                    <g 
                        key={conn.id} 
                        className="pointer-events-auto" 
                        onClick={(e) => { e.stopPropagation(); onSelectConnection(conn.id, e); }}
                    >
                        <path 
                            id={`conn-path-${conn.id}`}                             d={path} 
                            stroke={conn.color || (isSelected ? "var(--accent)" : "var(--foreground)")} 
                            strokeWidth={isSelected ? 2 : 1.5}
                            fill="none"
                            className="transition-colors duration-200 cursor-pointer"
                            markerEnd="url(#arrowhead)"
                        />
                         <path d={path} stroke="transparent" strokeWidth={15} fill="none" className="cursor-pointer" />
                    </g>
                );
            })})()}
        </svg>
    );
};
