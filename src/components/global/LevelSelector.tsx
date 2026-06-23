'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Book, FileText, ChevronRight, Plus, Check } from 'lucide-react';

export interface TopicMini {
  id: string;
  title: string;
}

export interface SubjectMini {
  id: string;
  name: string;
  topics: TopicMini[];
}

interface LevelSelectorProps {
  subjects: SubjectMini[];
  selectedSubjectId: string | null;
  selectedTopicId: string | null;
  onChange: (subjectId: string | null, topicId: string | null) => void;
}

export function LevelSelector({ subjects, selectedSubjectId, selectedTopicId, onChange }: LevelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeSubject = subjects.find(s => s.id === selectedSubjectId);
  const activeTopic = activeSubject?.topics.find(t => t.id === selectedTopicId);

  const handleSelectWorkspace = () => {
    onChange(null, null);
    setIsOpen(false);
  };

  const handleSelectSubject = (subjectId: string) => {
    onChange(subjectId, null);
    setIsOpen(false);
  };

  const handleSelectTopic = (subjectId: string, topicId: string) => {
    onChange(subjectId, topicId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Interactive Breadcrumb Pill */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center h-[26px] bg-[#27272a]/80 hover:bg-[#27272a] border border-white/5 rounded-full px-1.5 transition-all group shadow-sm"
      >
        {/* Workspace Level (Always visible) */}
        <div 
          onClick={(e) => { e.stopPropagation(); handleSelectWorkspace(); }}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
            !selectedSubjectId && !selectedTopicId ? 'text-indigo-400 bg-indigo-500/10 font-medium' : 'text-white/50 hover:text-white/90'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span className="text-[11px]">Dashboard</span>
        </div>

        {/* Subject Level */}
        {activeSubject && (
          <>
            <ChevronRight className="w-3 h-3 text-white/20 mx-0.5 shrink-0" />
            <div 
              onClick={(e) => { e.stopPropagation(); handleSelectSubject(activeSubject.id); }}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                selectedSubjectId && !selectedTopicId ? 'text-indigo-400 bg-indigo-500/10 font-medium' : 'text-white/50 hover:text-white/90'
              }`}
            >
              <Book className="w-3 h-3" />
              <span className="max-w-[80px] truncate text-[11px]">{activeSubject.name}</span>
            </div>
          </>
        )}

        {/* Topic Level */}
        {activeTopic && activeSubject && (
          <>
            <ChevronRight className="w-3 h-3 text-white/20 mx-0.5 shrink-0" />
            <div 
              onClick={(e) => { e.stopPropagation(); handleSelectTopic(activeSubject.id, activeTopic.id); }}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                selectedTopicId ? 'text-indigo-400 bg-indigo-500/10 font-medium' : 'text-white/50 hover:text-white/90'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span className="max-w-[80px] truncate text-[11px]">{activeTopic.title}</span>
            </div>
          </>
        )}

        {/* Add Button if not at max depth */}
        {!selectedTopicId && (
          <>
            <div className="w-[1px] h-3.5 bg-white/10 mx-1.5" />
            <div className="px-1 text-white/40 hover:text-white/90 transition-colors flex items-center opacity-0 group-hover:opacity-100">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-64 max-h-[300px] overflow-y-auto custom-scrollbar bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl flex flex-col p-1 z-[110]"
          >
            <div className="px-2 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {selectedSubjectId ? 'Change Level or Select Topic' : 'Select Subject'}
            </div>
            
            {/* Dashboard Option */}
            <button
              onClick={handleSelectWorkspace}
              className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-[12px] font-medium transition-colors ${
                !selectedSubjectId ? 'bg-indigo-500/10 text-indigo-300' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                <span>Dashboard (Global)</span>
              </div>
              {!selectedSubjectId && <Check className="w-3 h-3" />}
            </button>

            {/* If a subject is selected, only show that subject and its topics */}
            {selectedSubjectId ? (
              activeSubject && (
                <div className="mt-1">
                  <button
                    onClick={() => handleSelectSubject(activeSubject.id)}
                    className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-[12px] font-medium transition-colors ${
                      !selectedTopicId ? 'bg-indigo-500/10 text-indigo-300' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Book className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{activeSubject.name}</span>
                    </div>
                    {!selectedTopicId && <Check className="w-3 h-3" />}
                  </button>
                  
                  {activeSubject.topics.length === 0 ? (
                     <div className="pl-7 pr-2 py-1.5 text-[11px] text-white/30 italic">No topics found</div>
                  ) : (
                    activeSubject.topics.map(topic => (
                      <button
                        key={topic.id}
                        onClick={() => handleSelectTopic(activeSubject.id, topic.id)}
                        className={`flex items-center justify-between w-full pl-7 pr-2 py-1.5 rounded-lg text-left text-[12px] font-medium transition-colors ${
                          selectedTopicId === topic.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-white/50 hover:bg-white/5 hover:text-white/90'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3 h-3 opacity-50" />
                          <span className="truncate">{topic.title}</span>
                        </div>
                        {selectedTopicId === topic.id && <Check className="w-3 h-3" />}
                      </button>
                    ))
                  )}
                </div>
              )
            ) : (
              /* If NO subject is selected, show ALL subjects but hide their topics */
              subjects.map(subject => (
                <div key={subject.id} className="mt-1">
                  <button
                    onClick={() => handleSelectSubject(subject.id)}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-[12px] font-medium transition-colors text-white/70 hover:bg-white/5 hover:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <Book className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{subject.name}</span>
                    </div>
                  </button>
                </div>
              ))
            )}
            
            {subjects.length === 0 && (
              <div className="px-2 py-3 text-center text-[11px] text-white/40">
                No subjects found.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
