'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutDashboard, Settings } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { SidebarSubject } from './SidebarSubject';

// Dummy data resembling an API response
const INITIAL_SUBJECTS = [
  {
    id: 'subj-1',
    title: 'TypeScript Prep',
    topics: [
      { id: 'topic-1', title: 'Generics' },
      { id: 'topic-2', title: 'Utility Types' },
      { id: 'topic-3', title: 'Advanced Inference' },
    ]
  },
  {
    id: 'subj-2',
    title: 'System Design',
    topics: [
      { id: 'topic-4', title: 'CAP Theorem' },
      { id: 'topic-5', title: 'Message Queues' },
      { id: 'topic-6', title: 'Database Sharding' },
    ]
  }
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [subjects, setSubjects] = useState(INITIAL_SUBJECTS);

  React.useEffect(() => {
    const stored = localStorage.getItem('revise-sidebar-collapsed');
    if (stored) {
      setTimeout(() => {
        setIsCollapsed(stored === 'true');
      }, 1000);
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('revise-sidebar-collapsed', next.toString());
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Wait until 5px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setSubjects((prevSubjects) => {
      // Find the subject that contains the active topic
      const subjectIndex = prevSubjects.findIndex(subj => 
        subj.topics.some(t => t.id === active.id)
      );
      
      if (subjectIndex === -1) return prevSubjects;

      const subject = prevSubjects[subjectIndex];
      
      // Ensure the over item is in the same subject (no cross-subject drag support yet)
      const isOverInSameSubject = subject.topics.some(t => t.id === over.id);
      if (!isOverInSameSubject) return prevSubjects;

      const oldIndex = subject.topics.findIndex(t => t.id === active.id);
      const newIndex = subject.topics.findIndex(t => t.id === over.id);

      const newTopics = arrayMove(subject.topics, oldIndex, newIndex);
      
      const newSubjects = [...prevSubjects];
      newSubjects[subjectIndex] = {
        ...subject,
        topics: newTopics
      };

      return newSubjects;
    });
  };

  return (
    <aside 
      className={`${isCollapsed ? 'w-16' : 'w-64'} bg-sidebar border-r flex flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative z-50`}
    >
      <div className={`flex items-center h-14 border-b border-border/50 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!isCollapsed && <span className="font-bold text-base tracking-tight text-foreground">Revise</span>}
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-hover text-muted-foreground transition-colors flex-shrink-0"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pt-4 space-y-1 overflow-x-hidden pb-4">
        <div className="px-3 ">
          <Link 
            href="/dashboard" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-hover text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Dashboard" : undefined}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Dashboard</span>}
          </Link>
        </div>

      

        <div className="flex flex-col w-full px-1">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {subjects.map(subject => (
              <SidebarSubject 
                key={subject.id} 
                subject={subject} 
                isCollapsed={isCollapsed} 
              />
            ))}
          </DndContext>
        </div>
      </nav>

      <div className="p-3 border-t border-border/50">
        <button 
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-hover text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
