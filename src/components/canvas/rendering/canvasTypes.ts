export interface CanvasDragStart {
  blockId: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  startX: number;
  startY: number;
}

export interface DraftConnection {
  fromBlock: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  currentX: number;
  currentY: number;
}
