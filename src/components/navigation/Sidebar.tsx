'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutDashboard, Settings, Calendar, Brain, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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

import { reorderTopics } from '@/app/actions';

import { useAppStore } from '@/store/useAppStore';
import { RevisionSidebar } from './RevisionSidebar';
import { CreateSubjectModal } from '@/components/subject/CreateSubjectModal';

interface Topic {
  id: string;
  title: string;
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-[9px] rounded-lg text-[13.5px] font-medium transition-all duration-200 group relative outline-none subpixel-antialiased ${
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-hover'
      } ${isCollapsed ? 'justify-center h-10 w-10 mx-auto px-0' : ''}`}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 rounded-lg bg-hover/80"
          initial={false}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-line"
          className="absolute left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-accent"
          initial={false}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
      <span className={`shrink-0 transition-all duration-300 relative z-10 ${isActive ? 'text-foreground' : 'group-hover:scale-110'}`}>
        <Icon className="w-4 h-4" />
      </span>
      {!isCollapsed && <span className="truncate relative z-10 tracking-tight">{label}</span>}
    </Link>
  );
}

export function Sidebar({ initialSubjects }: { initialSubjects: Subject[] }) {
  const { 
    subjects, setSubjects, 
    isSidebarCollapsed: isCollapsed, setIsSidebarCollapsed, 
    initializeSidebarState,
    initializeTypographyState,
    isSplitViewActive,
    revisionQueue
  } = useAppStore();
  const pathname = usePathname();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  React.useEffect(() => {
    setSubjects(initialSubjects);
  }, [initialSubjects, setSubjects]);

  React.useEffect(() => {
    setTimeout(() => {
      initializeSidebarState();
      initializeTypographyState();
    }, 1000);
  }, [initializeSidebarState, initializeTypographyState]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isCollapsed);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
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

    const prevSubjects = subjects;
    const subjectIndex = prevSubjects.findIndex(subj => 
      subj.topics.some(t => t.id === active.id)
    );
    
    if (subjectIndex === -1) return;

    const subject = prevSubjects[subjectIndex];
    
    const isOverInSameSubject = subject.topics.some(t => t.id === over.id);
    if (!isOverInSameSubject) return;

    const oldIndex = subject.topics.findIndex(t => t.id === active.id);
    const newIndex = subject.topics.findIndex(t => t.id === over.id);

    const newTopics = arrayMove(subject.topics, oldIndex, newIndex);
    
    const newSubjects = [...prevSubjects];
    newSubjects[subjectIndex] = {
      ...subject,
      topics: newTopics
    };

    reorderTopics(subject.id, newTopics.map(t => t.id)).catch(console.error);
    setSubjects(newSubjects);
  };

  const isRevisionActive = revisionQueue && revisionQueue.length > 0 && pathname?.startsWith('/topic/');

  return (
    <>
      <motion.aside 
        animate={{ width: isRevisionActive || isSplitViewActive ? 0 : isCollapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`bg-sidebar flex flex-col shrink-0 overflow-hidden relative z-50 ${isRevisionActive || isSplitViewActive ? 'border-r-0 opacity-0 pointer-events-none' : 'border-r border-border/50'}`}
      >
        <div className={`flex items-center pt-4 pb-2 px-3 shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg flex-1 min-w-0">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-accent">R</span>
              </div>
              <span className="font-semibold text-[14px] tracking-tight text-foreground/90 truncate">Revise</span>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className={`p-1.5 rounded-md hover:bg-hover text-muted-foreground hover:text-foreground transition-colors shrink-0 ${isCollapsed ? 'mx-auto mt-1' : ''}`}
          >
            {isCollapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto pt-2 space-y-1 overflow-x-hidden pb-4 custom-scrollbar">
          <div className="px-3 space-y-0.5 shrink-0">
            <NavItem 
              href="/dashboard" 
              label="Overview" 
              icon={LayoutDashboard} 
              isActive={pathname === '/dashboard'} 
              isCollapsed={isCollapsed} 
            />
            <NavItem 
              href="/dashboard/planner" 
              label="Planner" 
              icon={Calendar} 
              isActive={pathname === '/dashboard/planner'} 
              isCollapsed={isCollapsed} 
            />
            <NavItem 
              href="/dashboard/knowledge" 
              label="Knowledge" 
              icon={Brain} 
              isActive={pathname === '/dashboard/knowledge'} 
              isCollapsed={isCollapsed} 
            />
          </div>

          <div className="mx-4 my-3 h-[1px] bg-border/40 shrink-0" />

          <div className="flex items-center justify-between px-5 py-1 mb-1 shrink-0">
            {!isCollapsed && <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Subjects</span>}
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className={`p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-hover transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
              title="New Subject"
            >
              <Plus className="w-[14px] h-[14px]" />
            </button>
          </div>

          <div className="flex flex-col w-full px-2">
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

        <div className="p-3 border-t border-border/50 shrink-0 flex items-center justify-center">
          {!isCollapsed ? (
            <button className="flex-1 flex items-center justify-center gap-2 px-2 py-[7px] rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground transition-colors text-[13px] font-medium">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          ) : (
            <button className="p-2 rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.aside>
      
      <AnimatePresence>
        {isRevisionActive && <RevisionSidebar />}
      </AnimatePresence>
      
      <CreateSubjectModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </>
  );
}
