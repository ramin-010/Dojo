'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FileText } from 'lucide-react';
import Link from 'next/link';

interface SidebarTopicItemProps {
  topic: { id: string; title: string };
  isCollapsed: boolean;
}

export function SidebarTopicItem({ topic, isCollapsed }: SidebarTopicItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="group flex items-center px-2 py-1.5 my-0.5 rounded-md hover:bg-hover text-[13px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
    >
      {!isCollapsed && (
        <button
          className="p-0.5 -ml-1 mr-1.5 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      
      <Link 
        href={`/topic/${topic.id}`} 
        className={`flex items-center gap-2.5 flex-1 ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? topic.title : undefined}
      >
        <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
        {!isCollapsed && <span className="whitespace-nowrap truncate">{topic.title}</span>}
      </Link>
    </div>
  );
}
