'use client';

import React, { useState, useEffect, useRef, startTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Play, Circle, List, PowerOff } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface Topic {
  id: string;
  title: string;
}

interface RevisionTopicItemProps {
  topic: Topic;
  isActive: boolean;
}

function RevisionTopicItem({ topic, isActive }: RevisionTopicItemProps) {
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
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`group flex items-center px-3 py-2.5 my-1 rounded-md text-[13px] font-medium transition-colors border ${
        isActive 
          ? 'bg-accent/10 text-accent border-accent/20' 
          : 'bg-transparent text-foreground/60 border-transparent hover:bg-hover hover:text-foreground'
      }`}
    >
      <button
        className="p-1 -ml-1 mr-2 text-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      
      <Link 
        href={`/topic/${topic.id}`} 
        className="flex items-center gap-3 flex-1 truncate"
      >
        {isActive ? (
          <Play className="w-4 h-4 shrink-0 fill-current text-accent" />
        ) : (
          <Circle className="w-4 h-4 shrink-0 opacity-40 text-foreground" />
        )}
        <span className="truncate">{topic.title}</span>
      </Link>
    </div>
  );
}

export function RevisionSidebar() {
  const { revisionQueue, setRevisionQueue } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isMinimized, setIsMinimized] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsMinimized(true);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarRef]);

  if (!revisionQueue || revisionQueue.length === 0) return null;

  const currentTopicId = pathname?.split('/').pop();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = revisionQueue.findIndex(t => t.id === active.id);
    const newIndex = revisionQueue.findIndex(t => t.id === over.id);

    setRevisionQueue(arrayMove(revisionQueue, oldIndex, newIndex));
  };

  const endSession = () => {
    router.back(); 
    setTimeout(() => {
      setRevisionQueue(null);
    }, 500); 
  };

  if (isMinimized) {
    return (
      <motion.button 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        onClick={() => setIsMinimized(false)}
        className="absolute top-4 left-4 z-[60] p-2 rounded-md hover:bg-hover text-muted-foreground hover:text-foreground transition-colors bg-sidebar border border-border shadow-md"
        title="Open Revision Queue"
      >
        <List className="w-5 h-5" />
      </motion.button>
    );
  }

  return (
    <motion.aside 
      initial={{ x: '-100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      ref={sidebarRef}
      className="absolute left-0 top-1/2 -translate-y-1/2 w-72 bg-sidebar border-r border-y border-border h-[70vh] rounded-r-2xl flex flex-col z-[60] overflow-hidden shadow-none"
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={revisionQueue.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {revisionQueue.map((topic) => (
              <RevisionTopicItem 
                key={topic.id} 
                topic={topic} 
                isActive={currentTopicId === topic.id}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      
      <div className="p-3 border-t border-border bg-sidebar flex items-center justify-end">
         <button 
          onClick={endSession}
          className="flex items-center gap-1.5 p-1.5 px-3 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors text-[10px] uppercase font-bold tracking-wider"
          title="End Session"
        >
          <PowerOff className="w-3 h-3" /> End
        </button>
      </div>
    </motion.aside>
  );
}
