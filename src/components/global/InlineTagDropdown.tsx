import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, CornerDownLeft } from 'lucide-react';
import { NoteCategory } from '@prisma/client';

interface InlineTagDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  categories: NoteCategory[];
  onSelectTag: (tag: NoteCategory) => void;
  onCreateTag: (tagName: string) => void;
  onClose: () => void;
  caretPosition?: { top: number; left: number; height: number } | null;
}

export interface InlineTagDropdownHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const InlineTagDropdown = forwardRef<InlineTagDropdownHandle, InlineTagDropdownProps>(
  ({ isOpen, searchQuery, categories, onSelectTag, onCreateTag, onClose, caretPosition }, ref) => {
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    // Filter categories based on search query
    const displayOptions = useMemo(() => {
      if (!searchQuery.trim()) return categories;
      return categories.filter(c => 
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
    }, [searchQuery, categories]);

    const exactMatch = useMemo(() => {
      return categories.some(
        c => c.name.toLowerCase() === searchQuery.trim().toLowerCase()
      );
    }, [searchQuery, categories]);

    const hasCreateOption = searchQuery.trim().length > 0 && !exactMatch;
    const totalOptions = displayOptions.length + (hasCreateOption ? 1 : 0);

    useEffect(() => {
      setHighlightedIndex(0);
    }, [displayOptions.length, hasCreateOption]);

    useImperativeHandle(ref, () => ({
      handleKeyDown: (e: React.KeyboardEvent): boolean => {
        if (!isOpen) return false;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % totalOptions);
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
          return true;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          
          if (highlightedIndex < displayOptions.length) {
            onSelectTag(displayOptions[highlightedIndex]);
            onClose();
          } else if (hasCreateOption) {
            onCreateTag(searchQuery.trim());
            onClose();
          }
          return true;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return true;
        }
        return false;
      }
    }));

    if (!isOpen) return null;

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
            style={{
              top: caretPosition ? caretPosition.top + caretPosition.height + 4 : '100%',
              left: caretPosition ? caretPosition.left : 0,
              marginTop: caretPosition ? 0 : '0.5rem'
            }}
          >
            {displayOptions.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                  Suggestions
                </div>
                {displayOptions.map((cat, index) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onSelectTag(cat);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isHighlighted ? "bg-indigo-500/20 text-indigo-100" : "text-white/70 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 opacity-40" />
                        <span>{cat.name}</span>
                      </div>
                      {isHighlighted && <CornerDownLeft className="w-3 h-3 opacity-40" />}
                    </button>
                  );
                })}
              </div>
            )}
            
            {hasCreateOption && (
              <div className="py-1 border-t border-white/5">
                <button
                  onClick={() => {
                    onCreateTag(searchQuery.trim());
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    highlightedIndex === displayOptions.length ? "bg-indigo-500/20 text-indigo-100" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 text-[10px] font-medium">
                      +
                    </div>
                    <span>Create "{searchQuery.trim()}"</span>
                  </div>
                  {highlightedIndex === displayOptions.length && <CornerDownLeft className="w-3 h-3 opacity-40" />}
                </button>
              </div>
            )}
            
            {totalOptions === 0 && (
              <div className="px-3 py-3 text-sm text-white/40 text-center">
                No tags found
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

InlineTagDropdown.displayName = 'InlineTagDropdown';
