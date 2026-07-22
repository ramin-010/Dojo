'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper } from '@tiptap/react';
import { X, ZoomIn, Loader2, GripHorizontal } from 'lucide-react';

interface GalleryImage {
  src: string;
  alt?: string;
  uploading?: boolean;
}

export function ImageGalleryNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const images: GalleryImage[] = node.attrs.images || [];
  const containerHeight: number | null = node.attrs.containerHeight || null;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [wasSelectedOnMouseDown, setWasSelectedOnMouseDown] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    if (newImages.length === 0) {
      deleteNode();
    } else {
      updateAttributes({ images: newImages });
    }
  }, [images, updateAttributes, deleteNode]);

  // Close lightbox on Escape
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY.current;
      const newHeight = Math.max(80, startHeight.current + deltaY);
      updateAttributes({ containerHeight: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, updateAttributes]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startY.current = e.clientY;
    if (containerRef.current) {
      startHeight.current = containerRef.current.getBoundingClientRect().height;
    }
  };

  if (images.length === 0) return null;

  // Determine grid layout based on image count
  const getGridClass = () => {
    switch (images.length) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-3';
      default:
        return 'grid-cols-2 sm:grid-cols-3';
    }
  };

  return (
    <NodeViewWrapper
      className={`image-gallery-wrapper my-2 select-none ${selected ? 'ring-1 ring-blue-500/50 rounded-xl' : ''}`}
      data-type="image-gallery"
    >
      <div 
        ref={containerRef}
        className={`grid ${getGridClass()} gap-2 relative group select-none`}
        style={{ height: containerHeight ? `${containerHeight}px` : undefined }}
      >
        {images.map((image, index) => (
          <div
            key={`${image.src}-${index}`}
            className="relative group/img rounded-xl overflow-hidden border border-divider bg-transparent cursor-pointer h-full w-full select-none"
            style={{
              aspectRatio: !containerHeight ? (images.length === 1 ? 'auto' : '4/3') : undefined,
            }}
          >
            {image.uploading ? (
              <div className="w-full h-full flex items-center justify-center min-h-[120px]">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Uploading...</span>
                </div>
              </div>
            ) : (
              <img
                src={image.src}
                alt={image.alt || 'Gallery image'}
                className={`w-full h-full ${containerHeight ? 'object-contain' : 'object-cover'} hover:scale-[1.02] transition-transform duration-300`}
                draggable={false}
                onMouseDown={() => setWasSelectedOnMouseDown(selected)}
                onClick={() => {
                  // Only open if it was already selected BEFORE the click started.
                  // Otherwise, this click just serves to select the node.
                  if (selected && wasSelectedOnMouseDown) {
                    setLightboxIndex(index);
                  }
                }}
              />
            )}

            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeImage(index);
              }}
              className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-black text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Zoom icon */}
            {!image.uploading && (
              <button
                onMouseDown={() => setWasSelectedOnMouseDown(selected)}
                onClick={(e) => {
                  if (selected && wasSelectedOnMouseDown) {
                    e.stopPropagation();
                    setLightboxIndex(index);
                  }
                }}
                className="absolute bottom-1.5 right-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Resize Handle */}
        <div 
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-4 flex items-center justify-center cursor-row-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onMouseDown={handleResizeStart}
          onDoubleClick={() => updateAttributes({ containerHeight: null })}
        >
          <div className="bg-muted-foreground/30 hover:bg-blue-500 text-foreground/50 hover:text-white rounded-full px-4 py-0.5 flex items-center justify-center shadow-sm transition-colors backdrop-blur-sm">
            <GripHorizontal className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && images[lightboxIndex] && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={images[lightboxIndex].src}
            alt={images[lightboxIndex].alt || 'Full image'}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  );
}
