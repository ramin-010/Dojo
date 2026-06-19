export interface Connection {
  id: string;
  fromBlock: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toBlock: string;
  toSide: 'top' | 'right' | 'bottom' | 'left';
  controlPoint1?: { x: number, y: number }; 
  controlPoint2?: { x: number, y: number };
  color?: string;
  hidden?: boolean;
  originalBlockId?: string;
}

export interface BlockDims {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
