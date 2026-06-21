// Place this file at:  src/app/topic/[id]/hooks/useSidebarResize.ts
'use client';

import { useState, useEffect, useRef } from 'react';

interface UseSidebarResizeReturn {
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}

export function useSidebarResize(
  defaultWidth = 384,
): UseSidebarResizeReturn {
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const newWidth = window.innerWidth - e.clientX;
        const leftSidebarWidth =
          document.querySelector('aside')?.offsetWidth || 64;
        const maxAllowedWidth =
          window.innerWidth - leftSidebarWidth - 500;
        const clampedWidth = Math.min(
          Math.max(newWidth, 250),
          Math.min(800, maxAllowedWidth),
        );
        setSidebarWidth(clampedWidth);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
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
  }, [isDragging]);

  return { sidebarWidth, setSidebarWidth, isDragging, setIsDragging };
}