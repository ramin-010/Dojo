import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Connection, BlockDims } from '@/types/canvas';
import { CanvasDragStart } from './canvasTypes';
import { CanvasBlockData } from '../core/types';
import { v4 as uuidv4 } from 'uuid';
import { useConnectionDrag } from './useConnectionDrag';
import { ConnectionLine } from './ConnectionLine';
import { getAnchorPos as getAnchorPosFromRect, getSplinePath, calculateControlPoints } from './connectionGeometry';

interface ConnectionLayerProps {
    connections: Connection[];
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
    blocks: BlockDims[]; 
    fullBlocks?: CanvasBlockData[]; 
    onUpdateConnection?: (connection: Connection) => void;
    onRemoveConnection?: (id: string) => void;
    activeDragStart: CanvasDragStart | null;
    onDragComplete: () => void;
    getCanvasPoint: (e: { clientX: number, clientY: number }) => { x: number, y: number };
    selectedConnectionId: string | null;
    onSelectConnection: (id: string) => void;
    variant?: 'default' | 'controls'; 
    zoom?: number;
    renderConnections?: boolean;
}

export function ConnectionLayer({ 
    connections, 
    setConnections,
    blocks, 
    fullBlocks = [], 
    onUpdateConnection,
    onRemoveConnection,
    activeDragStart,
    onDragComplete,
    getCanvasPoint,
    selectedConnectionId,
    onSelectConnection,
    variant = 'default',
    zoom = 1,
    renderConnections = true
}: ConnectionLayerProps) {
    const containerRef = React.useRef<SVGSVGElement>(null); 
    const [draggingHandle, setDraggingHandle] = useState<{ connId: string, handle: 'cp1' | 'cp2' } | null>(null);

    const [internalDraft, setInternalDraft] = useState<{
        fromBlock: string;
        fromSide: 'top' | 'right' | 'bottom' | 'left';
        currentX: number;
        currentY: number;
    } | null>(null);

    useEffect(() => {
        if (variant === 'default' && activeDragStart) {
            setInternalDraft({
                fromBlock: activeDragStart.blockId,
                fromSide: activeDragStart.side,
                currentX: activeDragStart.startX,
                currentY: activeDragStart.startY
            });
        }
    }, [activeDragStart, variant]);

    const hasStartedRef = useRef(false);
    useEffect(() => { if (internalDraft) hasStartedRef.current = true; }, [internalDraft]);

    useConnectionDrag(
        variant === 'default' ? internalDraft : null,
        setInternalDraft,
        getCanvasPoint,
        blocks, 
        connections,
        setConnections
    );

    useEffect(() => {
        if (variant === 'default' && activeDragStart && !internalDraft && hasStartedRef.current) {
            onDragComplete();
            hasStartedRef.current = false; 
        }
    }, [internalDraft, activeDragStart, onDragComplete, variant]);


    const getAnchorPos = useCallback((blockId: string, side: 'top' | 'right' | 'bottom' | 'left') => {
        const el = document.getElementById(`smart-block-${blockId}`) || document.getElementById(blockId);
        const container = containerRef.current?.parentElement; 
        
        if (!el || !container) {
            const block = blocks.find(b => b.id === blockId);
            if (!block) return { x: 0, y: 0 };
            return getAnchorPosFromRect(block, side);
        }

        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const currentZoom = zoom || 1;

        const relX = (elRect.left - containerRect.left) / currentZoom;
        const relY = (elRect.top - containerRect.top) / currentZoom;
        const w = elRect.width / currentZoom;
        const h = elRect.height / currentZoom;

        return getAnchorPosFromRect({ x: relX, y: relY, width: w, height: h }, side);
    }, [blocks, zoom]); 

    const getControlPointsForConn = useCallback((conn: Connection) => {
        const start = getAnchorPos(conn.fromBlock, conn.fromSide);
        const end = getAnchorPos(conn.toBlock, conn.toSide);
        return calculateControlPoints(
            start, end, conn.fromSide, conn.toSide,
            conn.controlPoint1, conn.controlPoint2
        );
    }, [getAnchorPos]);

    const getPath = (conn: Connection) => {
        const start = getAnchorPos(conn.fromBlock, conn.fromSide);
        const end = getAnchorPos(conn.toBlock, conn.toSide);
        const { cp1, cp2 } = getControlPointsForConn(conn);
        return getSplinePath([start, cp1, cp2, end]);
    };

    useEffect(() => {
        if (variant !== 'controls' || !draggingHandle) return;

        let animationFrameId: number;

        const handleMouseMove = (e: MouseEvent) => {
            animationFrameId = requestAnimationFrame(() => {
                const { x, y } = getCanvasPoint(e);
                
                setConnections(prev => prev.map(c => {
                    if (c.id !== draggingHandle.connId) return c;
                    const currentCPs = getControlPointsForConn(c);
                    return {
                        ...c,
                        controlPoint1: draggingHandle.handle === 'cp1' ? { x, y } : currentCPs.cp1,
                        controlPoint2: draggingHandle.handle === 'cp2' ? { x, y } : currentCPs.cp2
                    };
                }));
            });
        };

        const handleMouseUp = () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            setDraggingHandle(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingHandle, getCanvasPoint, setConnections, variant, getControlPointsForConn]);

    
    return (
        <svg 
            ref={containerRef}
            className={`absolute inset-0 pointer-events-none overflow-visible w-full h-full ${variant === 'controls' ? 'z-[50]' : 'z-0'}`}
        >
            {connections.map(conn => {
                const isSelected = selectedConnectionId === conn.id;

                if (variant === 'default') {
                    if (!renderConnections) return null;
                    const fromBlock = blocks.find(b => b.id === conn.fromBlock);
                    const toBlock = blocks.find(b => b.id === conn.toBlock);
                    
                    return (
                        <ConnectionLine
                            key={conn.id}
                            connection={conn}
                            fromBlock={fromBlock}
                            toBlock={toBlock}
                            isSelected={isSelected}
                            onSelect={onSelectConnection}
                        />
                    );
                } else if (variant === 'controls' && isSelected) {
                     const { cp1, cp2 } = getControlPointsForConn(conn);
                     const midX = (cp1.x + cp2.x) / 2;
                     const midY = (cp1.y + cp2.y) / 2;

                     const COLORS = [
                         { name: 'Default', value: 'hsl(var(--muted-foreground))' },
                         { name: 'Red', value: '#ef4444' },
                         { name: 'Blue', value: '#3b82f6' },
                         { name: 'Green', value: '#22c55e' },
                         { name: 'Amber', value: '#f59e0b' },
                     ];

                     return (
                        <g 
                            key={`${conn.id}-controls`} 
                            className="pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                             <foreignObject x={midX - 60} y={midY - 40} width="90" height="10" opacity={0.7} className="overflow-visible">
                                 <div className="flex items-center justify-center gap-1 bg-background/90 border border-border rounded-full p-1 shadow-sm backdrop-blur-sm">
                                     {COLORS.map((c) => (
                                         <button
                                             key={c.name}
                                             className={`w-3 h-3 rounded-full border border-border transition-transform hover:scale-110 ${conn.color === c.value ? 'ring-2 ring-foreground ring-offset-1' : ''}`}
                                             style={{ backgroundColor: c.value }}
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 setConnections(prev => prev.map(cn => 
                                                     cn.id === conn.id ? { ...cn, color: c.value === 'hsl(var(--muted-foreground))' ? undefined : c.value } : cn
                                                 ));
                                             }}
                                             title={c.name}
                                         />
                                     ))}
                                 </div>
                             </foreignObject>

                             <circle 
                                 cx={cp1.x} cy={cp1.y} r={6} 
                                 fill="var(--background)" 
                                 stroke="var(--accent)" 
                                 strokeWidth={2}
                                 className="cursor-move"
                                 onMouseDown={(e) => {
                                     e.stopPropagation(); 
                                     setDraggingHandle({ connId: conn.id, handle: 'cp1' });
                                 }}
                                 onDoubleClick={(e) => {
                                     e.stopPropagation();
                                     setConnections(prev => prev.map(c => 
                                         c.id === conn.id ? { ...c, controlPoint1: undefined } : c
                                     ));
                                 }}
                             />
                             <circle 
                                 cx={cp2.x} cy={cp2.y} r={6} 
                                 fill="var(--background)" 
                                 stroke="var(--accent)" 
                                 strokeWidth={2}
                                 className="cursor-move"
                                 onMouseDown={(e) => {
                                     e.stopPropagation();
                                     setDraggingHandle({ connId: conn.id, handle: 'cp2' });
                                 }}
                                 onDoubleClick={(e) => {
                                     e.stopPropagation();
                                     setConnections(prev => prev.map(c => 
                                         c.id === conn.id ? { ...c, controlPoint2: undefined } : c
                                     ));
                                 }}
                             />
                        </g>
                     );
                }
                return null;
            })}

             {variant === 'default' && internalDraft && (
                (() => {
                    const start = getAnchorPos(internalDraft.fromBlock, internalDraft.fromSide);
                    const end = { x: internalDraft.currentX, y: internalDraft.currentY };
                    const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`; 
                    return (
                        <path 
                            d={path} 
                            stroke="var(--accent)" 
                            strokeWidth={2} 
                            strokeDasharray="5,5"
                            fill="none" 
                            markerEnd="url(#arrowhead)"
                            className="pointer-events-none"
                        />
                    );
                })()
             )}

            {variant === 'default' && (
                <defs>
                    <marker 
                        id="arrowhead" 
                        markerWidth="16" 
                        markerHeight="16" 
                        refX="16" 
                        refY="7" 
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <polygon points="0 0, 19 7, 0 14" fill="context-stroke" />
                    </marker>
                </defs>
            )}
        </svg>
    );
}
