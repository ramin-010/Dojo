'use client';

import React, { useState } from 'react';
import { GripVertical, X, Palette, FileText, Download, Loader2, Image as ImageIcon } from 'lucide-react';
// import { EmbedBlock } from './EmbedBlock';
// import { CodeBlock } from './CodeBlock';
import { BlockEditor } from './BlockEditor';
import { cn } from '@/lib/utils';
import { TaskStats } from './smartBlockTypes';

interface DragHandleProps {
  isVisible: boolean;
}

export const DragHandle: React.FC<DragHandleProps> = ({ isVisible }) => (
  <div className={cn(
    "smart-block-drag-handle",
    "absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground text-background shadow-lg z-[100] cursor-grab active:cursor-grabbing transition-opacity",
    isVisible ? "opacity-100" : "opacity-0"
  )}>
    <GripVertical className="w-3 h-3" />
  </div>
);

interface ControlsOverlayProps {
  isVisible: boolean;
  onDelete?: () => void;
  onUpdateColor?: (color: string) => void;
  currentColor?: string;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({ isVisible, onDelete }) => (
  <div className={cn(
    "absolute -top-2 -right-2 flex items-center gap-1 transition-opacity z-[100]",
    isVisible ? "opacity-100" : "opacity-0"
  )}>
    <button 
      onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
      className="p-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors border border-destructive/20"
      title="Delete Note"
    >
      <X className="w-3 h-3" />
    </button>
  </div>
);

interface AnchorPointsProps {
  isVisible: boolean;
  isDragging?: boolean;
  readOnly?: boolean;
  onAnchorMouseDown?: (side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onAnchorMouseUp?: (side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
}

export const AnchorPoints: React.FC<AnchorPointsProps> = ({ 
  isVisible, 
  isDragging,
  readOnly, 
  onAnchorMouseDown, 
  onAnchorMouseUp 
}) => {
  if (readOnly) return null;

  const anchorClassName = cn(
    "rounded-full border border-accent/30 bg-background z-[999] cursor-crosshair transition-all duration-200",
    isDragging ? "w-4 h-4 ring-2 ring-accent/10 shadow-[0_0_10px_rgba(0,120,212,0.2)]" : "w-3 h-3",
    isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
  );

  return (
    <>
      <div 
        className={cn(anchorClassName, "absolute -top-1.5 left-1/2 -translate-x-1/2")}
        onMouseDown={(e) => { e.stopPropagation(); onAnchorMouseDown?.('top', e); }}
        onMouseUp={(e) => { e.stopPropagation(); onAnchorMouseUp?.('top', e); }}
      />
      <div 
        className={cn(anchorClassName, "absolute top-1/2 -translate-y-1/2 -right-1.5")}
        onMouseDown={(e) => { e.stopPropagation(); onAnchorMouseDown?.('right', e); }}
        onMouseUp={(e) => { e.stopPropagation(); onAnchorMouseUp?.('right', e); }}
      />
      <div 
        className={cn(anchorClassName, "absolute -bottom-1.5 left-1/2 -translate-x-1/2")}
        onMouseDown={(e) => { e.stopPropagation(); onAnchorMouseDown?.('bottom', e); }}
        onMouseUp={(e) => { e.stopPropagation(); onAnchorMouseUp?.('bottom', e); }}
      />
      <div 
        className={cn(anchorClassName, "absolute top-1/2 -translate-y-1/2 -left-1.5")}
        onMouseDown={(e) => { e.stopPropagation(); onAnchorMouseDown?.('left', e); }}
        onMouseUp={(e) => { e.stopPropagation(); onAnchorMouseUp?.('left', e); }}
      />
    </>
  );
};

interface TaskProgressBarProps {
  taskStats: TaskStats | null;
}

export const TaskProgressBar: React.FC<TaskProgressBarProps> = ({ taskStats }) => {
  if (!taskStats) return null;
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
      <div 
        className="h-full bg-green-500/50 transition-all duration-500 ease-out"
        style={{ width: `${taskStats.progress}%` }}
      />
    </div>
  );
};

interface BlockContentProps {
  type: 'text' | 'image' | 'embed' | 'code' | 'stack' | 'file';
  content: string;
  url?: string;
  language?: string;
  isEditing: boolean;
  onUpdate: (content: string) => void;
  onBlur: () => void;
  onDelete?: () => void;
  onLanguageChange?: (language: string) => void;
  onMentionClick?: (topicId: string) => void;
  height?: number | 'auto';
  isUploading?: boolean;
  fileName?: string;
  fileSize?: number;
  onResourceAdd?: (data: { text: string; type: 'url' | 'text' }) => void;
}

export const BlockContent: React.FC<BlockContentProps> = ({ 
  type, 
  content, 
  url, 
  language,
  isEditing, 
  onUpdate, 
  onBlur,
  onDelete,
  onLanguageChange,
  onMentionClick,
  height,
  isUploading,
  fileName,
  fileSize,
  onResourceAdd
}) => {
  if (type === 'text') {
    if (isEditing) {
      return (
        <BlockEditor 
          content={content} 
          onChange={onUpdate}
          autoFocus={true}
          onBlur={onBlur}
          onDelete={onDelete}
          onMentionClick={onMentionClick}
          onResourceAdd={onResourceAdd}
        />
      );
    }
    return (
      <div 
        className="notion-editor h-full w-full" 
        style={{ color: 'inherit', fontSize: 'inherit' }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const mentionId = target.getAttribute('data-mention-id');
          if (mentionId && onMentionClick) {
            e.stopPropagation();
            onMentionClick(mentionId);
          }
        }}
      >
        <div 
          className="tiptap ProseMirror preview-prosemirror select-none h-full w-full"
          style={{ 
            maxWidth: '100%', 
            margin: 0, 
            paddingLeft: '4px', 
            paddingRight: '4px',
            paddingTop: '2px',
            paddingBottom: '2px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'inherit',
            fontSize: 'inherit',
            pointerEvents: 'auto', // Allow clicks for mentions
          }}
          dangerouslySetInnerHTML={{ __html: content || '' }}
        />
      </div>
    );
  }

  if (type === 'image') {
    if (isUploading) {
      return (
        <div className="w-full h-full min-h-[100px] flex items-center justify-center bg-[#1c1c1c] rounded-lg border border-[#2c2c2c] relative overflow-hidden">
          {/* Subtle minimalist shimmer */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          
          <div className="flex flex-col items-center gap-2.5 relative z-10">
            <Loader2 className="w-4 h-4 animate-spin text-[#666666]" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#555555]">Uploading</span>
          </div>
        </div>
      );
    }

    const imgSrc = url || content;
    if (!imgSrc) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg">
          <span className="text-xs text-muted-foreground/50">Loading image...</span>
        </div>
      );
    }
    
    const isAutoHeight = height === 'auto' || height === undefined;
    
    return (
      <img 
        src={imgSrc} 
        alt="Canvas block image"
        className={cn("w-full pointer-events-none select-none rounded-lg", isAutoHeight ? "h-auto" : "h-full object-cover")}
        draggable="false"
      />
    );
  }

  if (type === 'embed') {
    return (
      <div className="w-full h-full pointer-events-auto flex items-center justify-center bg-muted/20 border border-border">
        {/* Placeholder for EmbedBlock */}
        <span className="text-muted-foreground">Embed: {content}</span>
      </div>
    );
  }

  if (type === 'code') {
    return (
      <div className="w-full h-full pointer-events-auto flex flex-col bg-[#1e1e1e] text-white p-2 border border-border">
         {/* Placeholder for CodeBlock */}
         <div className="text-xs text-foreground/40 mb-1 border-b border-foreground/10 pb-1">{language || 'code'}</div>
         <pre className="text-sm flex-1 overflow-auto"><code className="whitespace-pre-wrap">{content}</code></pre>
      </div>
    );
  }

  if (type === 'file') {
    if (isUploading) {
      return (
        <div className="w-full h-full flex items-center justify-between bg-background border rounded-lg p-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground/40 animate-spin" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-4 w-32 bg-muted/50 rounded" />
              <div className="h-3 w-16 bg-muted/50 rounded" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="w-full h-full flex items-center justify-between bg-background border border-border rounded-lg p-3 shadow-sm pointer-events-auto hover:bg-muted/30 transition-colors group"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate" title={fileName || 'File'}>
              {fileName || 'Unknown File'}
            </span>
            {fileSize && (
              <span className="text-xs text-muted-foreground">
                {(fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </div>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Download File"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return null;
};
