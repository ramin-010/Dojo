'use client';

import React from 'react';
import { Type, Plus, ImagePlus, X } from 'lucide-react';

interface CanvasHeaderProps {
  coverImage?: string | null;
  showTitle?: boolean;
  title?: string;
  readOnly?: boolean;
  showCoverPicker: boolean;
  setShowCoverPicker: (show: boolean) => void;
  onTitleChange?: (title: string) => void;
  onToggleTitle?: (show: boolean) => void;
  onCoverChange?: (url: string | null) => void;
  headerRef: React.RefObject<HTMLDivElement | null>;
}

export function CanvasHeader({
  coverImage,
  showTitle,
  title,
  readOnly,
  showCoverPicker,
  setShowCoverPicker,
  onTitleChange,
  onToggleTitle,
  onCoverChange,
  headerRef,
}: CanvasHeaderProps) {
  return (
    <>
      <div ref={headerRef} className="w-full flex flex-col shrink-0 z-10 relative">
        {coverImage ? (
          <div className="w-full h-48 relative group">
            <img 
              src={coverImage} 
              alt="Cover" 
              className="w-full h-full object-cover object-[0_50%]"
            />
            
            {!readOnly && (
              <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    const url = window.prompt('Enter image URL for cover:');
                    if (url) onCoverChange?.(url);
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-black/50 hover:bg-black/70 text-white text-xs backdrop-blur-sm"
                >
                  Change cover
                </button>
                <button
                  type="button"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onCoverChange?.(null); }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : null}

        {showTitle !== false && (
          <div
            className={`relative z-10 w-full px-10 pb-5 ${coverImage ? 'my-0' : 'mt-6'}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={title || ''}
              onChange={(e) => onTitleChange?.(e.target.value)}
              placeholder="Untitled Document"
              className={`w-full bg-transparent text-[62px] font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none border-none p-0 leading-tight ${readOnly ? 'pointer-events-none' : ''}`}
              readOnly={readOnly}
            />
          </div>
        )}

      </div>
    </>
  );
}
