'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SmartBlockProps } from './smartBlockTypes';
import { DEFAULT_FONT_SIZE } from '../core/types';
import { calculateTaskStats } from './smartBlockUtils';
import { Image as ImageIcon } from 'lucide-react';
import {
  DragHandle,
  AnchorPoints,
  TaskProgressBar,
  BlockContent
} from './BlockComponents';

function SmartBlockComponent({
  id,
  type = 'text',
  content,
  language,
  url,
  width,
  height,
  x,
  y,
  isSelected = false,
  onUpdateBlock,
  onDeleteBlock,
  onFocus,
  onAnchorMouseDown,
  onAnchorMouseUp,
  onDimensionsChange,
  readOnly,
  isConnectionDragging,
  color,
  textColor,
  onEditRequest,
  fontSize,
  isConnected,
  onMentionClick,
  isUploading,
  fileName,
  fileSize,
  onResourceAdd,
  topicId,
  subjectId,
  onRegisterHeight,
  metadata,
}: SmartBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const bgColor = color; 

  const blockRef = useRef<HTMLDivElement>(null);
  
  const lastDimUpdate = useRef<number>(0);
  const dimUpdateTimeout = useRef<any>(null);

  useEffect(() => {
    if (!blockRef.current) return;

    const observer = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        for (const entry of entries) {
          const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          
          if (onRegisterHeight) {
            onRegisterHeight(id, height);
          }
          
          if (onDimensionsChange) {
            const now = Date.now();
            if (now - lastDimUpdate.current > 100) {
               onDimensionsChange(id, width, height);
               lastDimUpdate.current = now;
            } else {
               if (dimUpdateTimeout.current) clearTimeout(dimUpdateTimeout.current);
               dimUpdateTimeout.current = setTimeout(() => {
                 onDimensionsChange(id, width, height);
                 lastDimUpdate.current = Date.now();
               }, 100);
            }
          }
        }
      });
    });

    observer.observe(blockRef.current);
    return () => {
      observer.disconnect();
      if (dimUpdateTimeout.current) clearTimeout(dimUpdateTimeout.current);
    };
  }, [id, onDimensionsChange, onRegisterHeight]);

  const taskStats = useMemo(() => calculateTaskStats(content), [content]);

  const currentFontSize = (type === 'text' && fontSize) ? fontSize : DEFAULT_FONT_SIZE;

  const isMinimalText = type === 'text' && !isEditing && !isConnected && !color;

  const lastClickTimeRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 300) {
      if (type === 'text') {
        e.stopPropagation();
        if (onEditRequest) {
          onEditRequest(id);
        } else {
          setIsEditing(true);
        }
      }
    }
    lastClickTimeRef.current = now;
  };

  return (
    <div
      ref={blockRef}
      id={`smart-block-${id}`}
      className={cn(
        "relative group flex flex-col animate-in fade-in zoom-in-95 duration-200",
        isMinimalText
          ? "rounded-none border-transparent bg-background/95 shadow-none"
          : "rounded-md border bg-background/95 " + (isEditing ? "shadow-md" : "shadow-none"),
        isSelected && !isMinimalText
          ? "border-foreground/25 ring-1 ring-foreground/10"
          : isSelected && isMinimalText
            ? "ring-1 ring-foreground/10 rounded-md"
            : isConnected 
              ? "border-divider/50 bg-hover/60" 
              : "border-divider",
        !isEditing && "smart-block-drag-handle cursor-grab active:cursor-grabbing",
        !isMinimalText && bgColor
      )}
      style={{
        contain: 'layout style paint',
        width: '100%',
        height: height === 'auto' || height === undefined ? 'auto' : '100%',
        color: textColor || undefined,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        onFocus?.(id);
      }}
    >
      {/* <DragHandle isVisible={isHovered || isSelected} /> */}
      
      <AnchorPoints 
        isVisible={isSelected || !!isConnectionDragging}
        isDragging={!!isConnectionDragging}
        readOnly={readOnly}
        onAnchorMouseDown={(side, e) => onAnchorMouseDown?.(id, side, e)}
        onAnchorMouseUp={(side, e) => onAnchorMouseUp?.(id, side, e)}
      />

      {metadata?.sourceImages && metadata.sourceImages.length > 0 && (
        <div className="absolute top-2 right-2 z-50 transition-opacity opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Just open the first source image for now
              window.dispatchEvent(new CustomEvent('CANVAS_OPEN_SPLIT_VIEW', { 
                detail: { 
                  type: 'resource', 
                  id: 'source-image',
                  data: { 
                    category: metadata.sourceImages!.length > 1 ? 'image_list' : 'image', 
                    url: metadata.sourceImages![0],
                    urls: metadata.sourceImages 
                  } 
                } 
              }));
            }}
            className="p-1.5 rounded-md bg-zinc-900/80 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors backdrop-blur-sm shadow-sm"
            title="View Original Notes"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div 
        className={cn(
          "relative z-10 transition-colors duration-200 rounded-lg",
          height === 'auto' || height === undefined ? "h-auto" : "flex-1 overflow-hidden"
        )}
        style={{
          fontSize: type === 'text' ? `${currentFontSize}px` : undefined,
          color: textColor || undefined,
        }}
      >
        <>
          <BlockContent 
            type={type}
            content={content}
            url={url}
            language={language}
            isEditing={isEditing}
            isUploading={isUploading}
            fileName={fileName}
            fileSize={fileSize}
            onUpdate={(newContent) => onUpdateBlock?.(id, { content: newContent })}
            onBlur={() => setIsEditing(false)}
            onLanguageChange={(lang) => onUpdateBlock?.(id, { language: lang })}
            onMentionClick={onMentionClick}
            height={height}
            onResourceAdd={onResourceAdd}
            topicId={topicId}
            subjectId={subjectId}
          />
          <TaskProgressBar taskStats={type === 'text' ? taskStats : null} />
        </>
      </div>
    </div>
  );
}

const arePropsEqual = (prev: SmartBlockProps, next: SmartBlockProps) => {
  return (
    prev.id === next.id &&
    prev.type === next.type &&
    prev.content === next.content &&
    prev.url === next.url &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.isSelected === next.isSelected &&
    prev.isConnectionDragging === next.isConnectionDragging &&
    prev.readOnly === next.readOnly &&
    prev.color === next.color &&
    prev.textColor === next.textColor &&
    prev.fontSize === next.fontSize &&
    prev.onEditRequest === next.onEditRequest &&
    prev.isConnected === next.isConnected &&
    prev.onMentionClick === next.onMentionClick &&
    prev.isUploading === next.isUploading &&
    prev.fileName === next.fileName &&
    prev.fileSize === next.fileSize &&
    prev.topicId === next.topicId &&
    prev.subjectId === next.subjectId &&
    prev.onResourceAdd === next.onResourceAdd
  );
};

export const SmartBlock = React.memo(SmartBlockComponent, arePropsEqual);
