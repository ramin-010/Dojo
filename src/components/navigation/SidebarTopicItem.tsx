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
      className={`group flex items-center px-1.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
        isDragging ? 'bg-hover/80 text-foreground' : 'text-muted-foreground/80 hover:bg-hover hover:text-foreground'
      }`}
    >
      {!isCollapsed && (
        <button
          className="p-1 -ml-1 mr-1 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-hover/50"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}
      
      <Link 
        href={`/topic/${topic.id}`} 
        className={`flex items-center gap-2.5 flex-1 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? topic.title : undefined}
      >
        <FileText className={`w-3.5 h-3.5 shrink-0 transition-colors ${isDragging ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground/90'}`} />
        {!isCollapsed && <span className="whitespace-nowrap truncate tracking-tight">{topic.title}</span>}
      </Link>
    </div>
  );
}
