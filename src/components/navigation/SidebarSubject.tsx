'use client';

import React, { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { SidebarTopicItem } from './SidebarTopicItem';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Topic {
  id: string;
  title: string;
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

interface SidebarSubjectProps {
  subject: Subject;
  isCollapsed: boolean;
}

export function SidebarSubject({ subject, isCollapsed }: SidebarSubjectProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);

  const activeTopics = subject.topics.filter(t => !(t as any).isArchived);
  const archivedTopics = subject.topics.filter(t => (t as any).isArchived);

  if (isCollapsed) {
    // When the whole sidebar is collapsed, we might just show a folder icon 
    // for the subject and hide the topics to save space and avoid a messy UI.
    return (
      <div className="flex justify-center py-2">
        <Link href={`/subject/${subject.id}`} title={subject.name} className="p-2 rounded-md hover:bg-hover text-muted-foreground hover:text-foreground">
          <Folder className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex items-center justify-between px-2 py-1 mb-0.5 rounded-md hover:bg-hover/50 group transition-colors">
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          <button 
            className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 p-0.5 rounded hover:bg-hover/80"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <Link 
            href={`/subject/${subject.id}`}
            className="flex-1 text-[13px] font-semibold text-foreground/80 tracking-tight truncate py-1"
          >
            {subject.name}
          </Link>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pl-4 pr-2 pb-1">
              <SortableContext 
                items={activeTopics.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {activeTopics.map(topic => (
                  <SidebarTopicItem 
                    key={topic.id} 
                    topic={topic} 
                    isCollapsed={isCollapsed} 
                  />
                ))}
              </SortableContext>
              
              {activeTopics.length === 0 && archivedTopics.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground/50 italic">
                  No topics yet
                </div>
              )}

              {archivedTopics.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <button 
                    onClick={() => setIsArchivedExpanded(!isArchivedExpanded)}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded hover:bg-hover/30"
                  >
                    {isArchivedExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Archived ({archivedTopics.length})
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isArchivedExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden pt-1"
                      >
                        {archivedTopics.map(topic => (
                          <div key={topic.id} className="opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0 transition-all">
                            <SidebarTopicItem 
                              topic={topic} 
                              isCollapsed={isCollapsed} 
                            />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
