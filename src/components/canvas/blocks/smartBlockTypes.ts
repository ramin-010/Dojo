export interface SmartBlockProps {
  id: string;
  type?: 'text' | 'image' | 'embed' | 'code' | 'file';
  content: string;
  language?: string;
  url?: string;
  fontSize?: number;
  textColor?: string;
  width: number;
  height: number | 'auto';
  x: number;
  y: number;
  isSelected?: boolean;
  onUpdateBlock?: (id: string, data: any) => void;
  onDeleteBlock?: (id: string) => void;
  onFocus?: (id: string) => void;
  onAnchorMouseDown?: (id: string, side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onAnchorMouseUp?: (id: string, side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onDimensionsChange?: (id: string, width: number, height: number) => void;
  isConnectionDragging?: boolean;
  readOnly?: boolean;
  color?: string;
  /** If provided, double-click on text blocks calls this instead of opening inline editor */
  onEditRequest?: (id: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  isConnected?: boolean;
  onMentionClick?: (topicId: string) => void;
  isUploading?: boolean;
  fileName?: string;
  fileSize?: number;
  onResourceAdd?: (data: { text: string; type: 'url' | 'text' }) => void;
  topicId?: string;
  subjectId?: string;
  onRegisterHeight?: (id: string, height: number) => void;
  metadata?: {
    sourceImages?: string[];
    [key: string]: any;
  };
  isCollapsed?: boolean;
  onExpand?: () => void;
}

export interface TaskStats {
  total: number;
  checked: number;
  progress: number;
}
