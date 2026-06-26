import { Connection } from '@/types/canvas';

export type { Connection } from '@/types/canvas';
export type { BlockDims } from '@/types/canvas';

export interface CanvasBlockData {
  blockId: string;
  type: 'text' | 'image' | 'embed' | 'code' | 'file';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number | 'auto';
  language?: string;
  color?: string;
  textColor?: string; 
  fontSize?: number; 
  url?: string;
  imageId?: string;
  isUploading?: boolean;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  metadata?: {
    sourceImages?: string[];
    [key: string]: any;
  };
}

export interface CanvasData {
  blocks: CanvasBlockData[];
  connections: Connection[];
}

export interface SelectedBlockInfo {
  blockId: string;
  type: string;
  fontSize?: number;
  textColor?: string;
  color?: string;
}

export interface CanvasProps {
  initialContent?: string; // JSON string of CanvasData
  onChange?: (content: string) => void;
  readOnly?: boolean;
  onSelectionChange?: (block: SelectedBlockInfo | null) => void;
  topicId?: string;
}

// Constants
export const DEFAULT_FONT_SIZE = 14;
export const CANVAS_WIDTH = 890;
export const CANVAS_MIN_HEIGHT = 1500;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const GUIDE_LINE_SPACING = 4;
