'use client';

import React, { useState, useEffect } from 'react';
import { Search, Pin, Clock, Lightbulb, CheckSquare, MessageSquare, Calendar, FileText, Trash2, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopicQuickNote, NoteCategory } from './types';
import { createQuickNote, togglePinQuickNote, deleteQuickNote } from '@/app/actions';

import { toast } from 'sonner';

interface TopicQuickNotesProps {
  quickNotes: TopicQuickNote[];
  noteCategories: NoteCategory[];
  topicId: string;
  subjectId: string;
}

export function TopicQuickNotes({ quickNotes, noteCategories, topicId, subjectId }: TopicQuickNotesProps) {
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Filter notes
  const filteredNotes = quickNotes.filter(n => {
    const matchesQuery = query === '' || 
      n.title?.toLowerCase().includes(query.toLowerCase()) || 
      n.content.toLowerCase().includes(query.toLowerCase());
    
    const matchesCategory = !activeCategoryId || n.categoryId === activeCategoryId;
    
    return matchesQuery && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const recentNotes = filteredNotes.filter(n => !n.isPinned);

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('idea')) return <Lightbulb className="w-4 h-4 text-blue-400" />;
    if (name.includes('to-do') || name.includes('todo')) return <CheckSquare className="w-4 h-4 text-emerald-400" />;
    if (name.includes('reminder')) return <Calendar className="w-4 h-4 text-fuchsia-400" />;
    if (name.includes('discussion') || name.includes('message')) return <MessageSquare className="w-4 h-4 text-amber-400" />;
    return <FileText className="w-4 h-4 text-white/60" />;
  };

  const getCategoryColorClass = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('idea')) return 'bg-blue-500/10 text-blue-400';
    if (name.includes('to-do') || name.includes('todo')) return 'bg-emerald-500/10 text-emerald-400';
    if (name.includes('reminder')) return 'bg-fuchsia-500/10 text-fuchsia-400';
    if (name.includes('discussion') || name.includes('message')) return 'bg-amber-500/10 text-amber-400';
    return 'bg-white/10 text-white/70';
  };

  const getCategoryBgClass = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('idea')) return 'bg-blue-500/10';
    if (name.includes('to-do') || name.includes('todo')) return 'bg-emerald-500/10';
    if (name.includes('reminder')) return 'bg-fuchsia-500/10';
    if (name.includes('discussion') || name.includes('message')) return 'bg-amber-500/10';
    return 'bg-white/5';
  };

  const handleSaveNote = async (data: { title: string; content: string; categoryName: string }) => {
    const result = await createQuickNote({
      subjectId,
      topicId,
      content: data.content,
      title: data.title.trim() || undefined,
      categoryName: data.categoryName.trim() || undefined,
    });

    if (result.error) {
      toast.error(result.error);
      throw new Error(result.error);
    } else {
      toast.success('Quick note added!');
    }
  };

  const handleTogglePin = async (id: string, currentlyPinned: boolean) => {
    const toastId = toast.loading(currentlyPinned ? 'Unpinning note...' : 'Pinning note...');
    const result = await togglePinQuickNote(id, !currentlyPinned);
    if (result.error) {
      toast.error(result.error, { id: toastId });
    } else {
      toast.success(currentlyPinned ? 'Note unpinned' : 'Note pinned', { id: toastId });
    }
  };

  const confirmDelete = async () => {
    if (!noteToDelete) return;
    const id = noteToDelete;
    setNoteToDelete(null);
    const toastId = toast.loading('Deleting note...');
    const result = await deleteQuickNote(id);
    if (result.error) {
      toast.error(result.error, { id: toastId });
    } else {
      toast.success('Note deleted', { id: toastId });
    }
  };

  const renderNoteCard = (note: TopicQuickNote) => {
    const categoryName = note.category?.name || 'Others';
    const displayTitle = note.title || note.content.split('\n')[0].slice(0, 50) + (note.content.length > 50 ? '...' : '');
    const displayContent = note.title ? note.content : note.content.split('\n').slice(1).join('\n') || note.content;
    const isExpanded = expandedNoteId === note.id;

    return (
      <div 
        key={note.id} 
        onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
        className="group p-3.5 rounded-xl border border-white/5 bg-black/20 hover:bg-white/[0.03] hover:border-white/10 transition-all relative flex gap-3.5 cursor-pointer"
      >
        <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center mt-0.5 ${getCategoryBgClass(categoryName)}`}>
          {getCategoryIcon(categoryName)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-medium text-white/90 truncate mb-1">{displayTitle}</h4>
          <p className={`text-[12px] text-muted-foreground/70 leading-snug mb-2 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>{displayContent}</p>
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryColorClass(categoryName)}`}>
              {categoryName}
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); handleTogglePin(note.id, note.isPinned); }}
            className={`p-1 rounded-md transition-opacity ${note.isPinned ? 'text-white/80' : 'text-muted-foreground/40 hover:text-white/80 opacity-0 group-hover:opacity-100'}`}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setNoteToDelete(note.id); }}
            className="text-muted-foreground/40 hover:text-red-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative">
      <style>{`
        .minimal-scroll::-webkit-scrollbar { display: none; }
        .minimal-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header section */}
      <div className="px-5 mt-1 pb-4">
        <p className="text-xs text-zinc-400 mb-2 mt-2">All the quick notes attached to this topic.</p>

        {/* Search & Action */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search quick notes..." 
              className="w-full bg-black/20 border border-white/5 rounded-lg py-1.5 pl-9 pr-3 text-[13px] text-white/90 placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/10 transition-colors"
            />
          </div>
          <button 
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg px-2 py-1 flex items-center gap-1.5 text-[11px] font-medium transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New note
          </button>
        </div>

        {/* Categories Filter */}
        {noteCategories.length > 0 && (
          <div className="mt-4 overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 minimal-scroll scale-[0.85] origin-left w-[117%]">
              <button 
                onClick={() => setActiveCategoryId(null)}
                className={`px-3 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activeCategoryId === null 
                    ? 'border-[#2563eb]/30 bg-[#2563eb]/10 text-[#60a5fa]' 
                    : 'border-white/5 bg-black/20 text-muted-foreground hover:bg-white/5 hover:text-white/80'
                }`}
              >
                All ({quickNotes.length})
              </button>
              {noteCategories.map(cat => {
                const count = quickNotes.filter(n => n.categoryId === cat.id).length;
                if (count === 0) return null;
                
                return (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`px-3 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap transition-colors ${
                      activeCategoryId === cat.id 
                        ? 'border-[#2563eb]/30 bg-[#2563eb]/10 text-[#60a5fa]' 
                        : 'border-white/5 bg-black/20 text-muted-foreground hover:bg-white/5 hover:text-white/80'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto px-5 pb-20 custom-scrollbar space-y-6">
        
        {quickNotes.length === 0 ? (
          <div className="text-center py-10 opacity-60">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-[13px] font-medium">No quick notes yet</p>
            <p className="text-[11px] mt-1">Capture your first thought for this topic.</p>
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-[13px] font-semibold text-white/90">Pinned</h3>
                </div>
                <div className="space-y-2">
                  {pinnedNotes.map(renderNoteCard)}
                </div>
              </div>
            )}

            {/* Recent Section */}
            {recentNotes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-[13px] font-semibold text-white/90">Recent</h3>
                </div>
                <div className="space-y-2">
                  {recentNotes.map(renderNoteCard)}
                </div>
              </div>
            )}

            {query !== '' && filteredNotes.length === 0 && (
              <div className="text-center py-8 text-[12px] text-muted-foreground">
                No notes match your search.
              </div>
            )}
          </>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {noteToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setNoteToDelete(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 shadow-2xl z-10 w-full max-w-sm"
            >
              <h3 className="text-lg font-medium text-white mb-2">Delete Note</h3>
              <p className="text-sm text-white/60 mb-6">Are you sure you want to delete this note? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setNoteToDelete(null)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-1 text-muted-foreground"
                  >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
