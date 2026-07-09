'use client';

import { useState, useEffect, useRef } from 'react';

interface UseSplitViewResizeReturn {
  splitViewWidth: number;
  setSplitViewWidth: (w: number) => void;
  isDraggingSplitView: boolean;
  setIsDraggingSplitView: (v: boolean) => void;
}

/**
 * Manages the resizable split-view pane width.
 * - Default: ~35vw
 * - Min: 300px (roughly 30vw on a 1080p screen)
 * - Max: 50vw (half the viewport)
 * Uses a CSS variable `--split-view-width` for smooth RAF-driven resizing.
 */
export function useSplitViewResize(
  defaultWidthVw = 35,
): UseSplitViewResizeReturn {
  const [splitViewWidth, setSplitViewWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return (defaultWidthVw / 100) * window.innerWidth;
    }
    return 600;
  });
  const [isDraggingSplitView, setIsDraggingSplitView] = useState(false);
  const rafRef = useRef<number>(0);
  const currentWidthRef = useRef(splitViewWidth);

  // Keep CSS var in sync with React state
  useEffect(() => {
    currentWidthRef.current = splitViewWidth;
    document.documentElement.style.setProperty('--split-view-width', `${splitViewWidth}px`);
  }, [splitViewWidth]);

  useEffect(() => {
    if (!isDraggingSplitView) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const newWidth = window.innerWidth - e.clientX;

        // Clamp: min 300px, max 50vw
        const minWidth = 300;
        const maxWidth = window.innerWidth * 0.5;

        const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

        currentWidthRef.current = clampedWidth;
        document.documentElement.style.setProperty('--split-view-width', `${clampedWidth}px`);
      });
    };

    const handleMouseUp = () => {
      setIsDraggingSplitView(false);
      setSplitViewWidth(currentWidthRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDraggingSplitView]);

  // Cleanup CSS var on unmount
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--split-view-width');
    };
  }, []);

  return { splitViewWidth, setSplitViewWidth, isDraggingSplitView, setIsDraggingSplitView };
}
