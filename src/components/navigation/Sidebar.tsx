'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  LogOutIcon,
  LayoutDashboard,
  Calendar,
  Brain,
  Palette,
  X
} from 'lucide-react';
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
          : 'text-muted hover:text-foreground hover:bg-hover'
      } ${isCollapsed ? 'justify-center h-10 w-10 mx-auto px-0 opacity-15 hover:opacity-100' : ''}`}
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

export function Sidebar({ initialSubjects, userName = "User" }: { initialSubjects: Subject[], userName?: string }) {
  const userInitials = userName.charAt(0).toUpperCase();

  const { 
    subjects, setSubjects, 
    isSidebarCollapsed: isCollapsed, setIsSidebarCollapsed, 
    initializeSidebarState,
    initializeTypographyState,
    initializeTopicThemeState,
    isSplitViewActive,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    revisionQueue,
    topicTheme,
    setTopicTheme
  } = useAppStore();
  const pathname = usePathname();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);

  // ── Global Theme Application ──
  React.useEffect(() => {
    // Clean up all possible themes first
    const allThemes = ['default', 'catppuccin-latte', 'light', 'sepia', 'gruvbox-light', 'rose-pine-dawn'];
    allThemes.forEach(t => document.body.classList.remove(`theme-${t}`));
    
    // Apply current theme
    if (topicTheme && topicTheme !== 'default') {
      document.body.classList.add(`theme-${topicTheme}`);
    }
  }, [topicTheme]);

  React.useEffect(() => {
    setSubjects(initialSubjects);
  }, [initialSubjects, setSubjects]);

  React.useEffect(() => {
    setTimeout(() => {
      initializeSidebarState();
      initializeTypographyState();
      initializeTopicThemeState();
    }, 1000);
  }, [initializeSidebarState, initializeTypographyState, initializeTopicThemeState]);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname, setIsMobileMenuOpen]);

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
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[90] md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside 
        animate={{ width: isRevisionActive || isSplitViewActive ? 0 : isCollapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`${isCollapsed ? 'bg-background border-r-transparent' : 'bg-sidebar border-r border-border/50'} flex flex-col shrink-0 overflow-hidden relative z-[100] ${isRevisionActive || isSplitViewActive ? 'border-r-0 opacity-0 pointer-events-none' : ''} max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:h-full max-md:shadow-2xl transition-transform duration-300 ${!isMobileMenuOpen ? 'max-md:-translate-x-full' : 'max-md:translate-x-0'} md:translate-x-0`}
      >
        <div className={`flex items-center pt-4 pb-2 px-3 shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg flex-1 min-w-0">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-accent">{userInitials}</span>
              </div>
              <span className="font-semibold text-[14px] tracking-tight text-foreground/90 truncate">{userName}</span>
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            className={`p-1.5 rounded-md hover:bg-hover text-muted hover:text-foreground transition-colors shrink-0 ${isCollapsed ? 'mx-auto mt-1' : ''}`}
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

          {!isCollapsed && <div className="mx-4 my-3 h-[1px] bg-border/40 shrink-0" />}

          {!isCollapsed && (
            <>
              <div className="flex items-center justify-between px-5 py-1 mb-1 shrink-0">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Subjects</span>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-1 rounded-md text-muted hover:text-foreground hover:bg-hover transition-all duration-200"
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
            </>
          )}
        </nav>

        <div className={`p-3 shrink-0 flex ${!isCollapsed ? 'items-center gap-2' : 'flex-col gap-2 items-center justify-center'}`}>
          {!isCollapsed ? (
            <>
              <button 
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.href = '/login';
                }} 
                className="flex-1 flex items-center justify-center gap-2 px-2 py-[7px] rounded-lg text-muted hover:bg-hover hover:text-foreground transition-colors text-[13px] font-medium"
              >
                <LogOutIcon className="w-4 h-4 shrink-0" />
                <span>Sign out</span>
              </button>
              <button 
                onClick={() => setIsThemeSettingsOpen(true)}
                className="p-[7px] rounded-lg text-muted hover:bg-hover hover:text-foreground transition-colors shrink-0"
                title="Theme Settings"
              >
                <Palette className="w-[18px] h-[18px]" />
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsThemeSettingsOpen(true)}
                className="p-2 rounded-lg text-muted hover:bg-hover hover:text-foreground transition-all duration-200 opacity-20 hover:opacity-100"
                title="Theme Settings"
              >
                <Palette className="w-4 h-4" />
              </button>
              <button 
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.href = '/login';
                }} 
                className="p-2 rounded-lg text-muted hover:bg-hover hover:text-foreground transition-all duration-200 opacity-20 hover:opacity-100"
                title="Sign out"
              >
                <LogOutIcon className="w-4 h-4" />
              </button>
            </>
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

      {/* Global Theme Settings Modal */}
      <AnimatePresence>
        {isThemeSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsThemeSettingsOpen(false)}
              className="absolute inset-0 bg-black/80"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
                  <Palette className="w-4 h-4 text-accent" />
                  App Theme
                </h2>
                <button 
                  onClick={() => setIsThemeSettingsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'default', label: 'Default', bg: 'bg-[#191919]', accent: 'bg-[#007acc]' },
                  { id: 'catppuccin-latte', label: 'Catppuccin', bg: 'bg-[#eff1f5]', accent: 'bg-[#8839ef]' },
                  { id: 'light', label: 'Light', bg: 'bg-[#f7f5f0]', accent: 'bg-[#3a5a7d]' },
                  { id: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]', accent: 'bg-[#a8672c]' },
                  { id: 'gruvbox-light', label: 'Gruvbox', bg: 'bg-[#ebdbb2]', accent: 'bg-[#d65d0e]' },
                  { id: 'rose-pine-dawn', label: 'Rosé Pine', bg: 'bg-[#faf4ed]', accent: 'bg-[#b4637a]' }
                ].map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setTopicTheme(theme.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      topicTheme === theme.id 
                        ? 'border-accent/40 bg-accent/10' 
                        : 'border-border/50 bg-background/50 hover:bg-hover'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${theme.bg} ring-2 ring-offset-2 ring-offset-transparent ${
                      topicTheme === theme.id ? 'ring-accent/50' : 'ring-transparent'
                    } flex items-center justify-center overflow-hidden relative shadow-sm`}>
                      <div className={`absolute right-0 bottom-0 w-2 h-2 ${theme.accent}`} />
                    </div>
                    <span className="text-[13px] font-medium text-foreground/80">{theme.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
