import React, { memo } from 'react';
import { Connection, BlockDims } from '@/types/canvas';
import { calculateConnectionPath } from './connectionGeometry';

interface ConnectionLineProps {
    connection: Connection;
    fromBlock: BlockDims | undefined;
    toBlock: BlockDims | undefined;
    isSelected: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
}

const ConnectionLineComponent: React.FC<ConnectionLineProps> = ({ 
    connection, 
    fromBlock, 
    toBlock, 
    isSelected, 
    onSelect 
}) => {
    if (!fromBlock || !toBlock) return null;

    const path = calculateConnectionPath(connection, [fromBlock, toBlock]);

    return (
        <g 
            className="pointer-events-auto" 
            onClick={(e) => { e.stopPropagation(); onSelect(connection.id, e); }}
        >
            <path 
                d={path} 
                stroke={connection.color || (isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))")} 
                strokeWidth={isSelected ? 3 : 2}
                fill="none"
                className="transition-colors duration-200 cursor-pointer hover:stroke-foreground"
                markerEnd="url(#arrowhead)"
            />
            <path d={path} stroke="transparent" strokeWidth={15} fill="none" className="cursor-pointer" />
        </g>
    );
};

const arePropsEqual = (prev: ConnectionLineProps, next: ConnectionLineProps) => {
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.connection.id !== next.connection.id) return false;
    if (prev.connection.color !== next.connection.color) return false;
    if (prev.connection.controlPoint1?.x !== next.connection.controlPoint1?.x) return false;
    if (prev.connection.controlPoint1?.y !== next.connection.controlPoint1?.y) return false;
    if (prev.connection.controlPoint2?.x !== next.connection.controlPoint2?.x) return false;
    if (prev.connection.controlPoint2?.y !== next.connection.controlPoint2?.y) return false;

    const b1Prev = prev.fromBlock;
    const b1Next = next.fromBlock;
    if (b1Prev?.x !== b1Next?.x || b1Prev?.y !== b1Next?.y || b1Prev?.width !== b1Next?.width || b1Prev?.height !== b1Next?.height) return false;

    const b2Prev = prev.toBlock;
    const b2Next = next.toBlock;
    if (b2Prev?.x !== b2Next?.x || b2Prev?.y !== b2Next?.y || b2Prev?.width !== b2Next?.width || b2Prev?.height !== b2Next?.height) return false;

    return true;
};

export const ConnectionLine = memo(ConnectionLineComponent, arePropsEqual);
