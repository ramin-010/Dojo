// Place this file at:  src/app/topic/[id]/components/TagsBar.tsx
'use client';

import React from 'react';
import { X, Plus } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
}

interface TagsBarProps {
  tags: Tag[];
  isAddingTag: boolean;
  setIsAddingTag: (v: boolean) => void;
  newTagText: string;
  setNewTagText: (v: string) => void;
  suggestedTags: Tag[];
  onCommitTag: (name: string) => Promise<void>;
  onRemoveTag: (id: string) => Promise<void>;
}

export function TagsBar({
  tags,
  isAddingTag,
  setIsAddingTag,
  newTagText,
  setNewTagText,
  suggestedTags,
  onCommitTag,
  onRemoveTag,
}: TagsBarProps) {
  return (
    /* Absolutely positioned — hovers in the gap above the title without shifting layout */
    <div className="absolute -top-[26px] left-0 flex items-center gap-2 text-[#a0a0a0] text-xs font-medium z-10">
      {/* Empty-state placeholder */}
      {tags.length === 0 && !isAddingTag && (
        <span
          onClick={() => setIsAddingTag(true)}
          className="px-2 py-1 border border-dashed border-white/10 rounded-md text-[#888888]/60 hover:text-foreground hover:bg-white/5 cursor-pointer transition-colors"
        >
          Add tags...
        </span>
      )}

      {/* Existing tags */}
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={async (e) => {
            e.stopPropagation();
            await onRemoveTag(tag.id);
          }}
          className="group relative flex items-center justify-center px-2 py-1 bg-white/5 border border-white/5 rounded-md hover:bg-white/10 hover:border-white/20 text-[#a0a0a0] hover:text-foreground transition-colors overflow-hidden"
          title="Click to remove tag"
        >
          <span className="group-hover:opacity-30 transition-opacity duration-300">
            {tag.name}
          </span>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <X className="w-3.5 h-3.5" />
          </div>
        </button>
      ))}

      {/* Tag input or add button */}
      {isAddingTag ? (
        <div className="relative">
          <input
            type="text"
            value={newTagText}
            onChange={(e) => setNewTagText(e.target.value)}
            onBlur={() => {
              setTimeout(() => {
                if (newTagText.trim() && suggestedTags.length === 0) {
                  onCommitTag(newTagText);
                } else {
                  setIsAddingTag(false);
                  setNewTagText('');
                }
              }, 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (newTagText.trim()) onCommitTag(newTagText);
              } else if (e.key === 'Escape') {
                setNewTagText('');
                setIsAddingTag(false);
              }
            }}
            autoFocus
            className="px-2 py-1 bg-white/5 border border-white/10 rounded-md outline-none text-foreground w-32 placeholder:text-[#888888]/50"
            placeholder="tag..."
          />
          {suggestedTags.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl overflow-hidden z-50">
              {suggestedTags.map((st) => (
                <div
                  key={st.id}
                  className="px-3 py-2 text-sm text-[#a0a0a0] hover:bg-white/5 hover:text-foreground cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    onCommitTag(st.name);
                  }}
                >
                  {st.name}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAddingTag(true)}
          className="flex items-center justify-center w-[25px] h-[25px] rounded-md border border-[#888888]/50 hover:bg-white/10 text-[#888888] hover:text-foreground transition-colors"
          title="Add tag"
        >
          <Plus className="w-3.5 h-3.5 text-[#888888]/50 hover:text-foreground" />
        </button>
      )}
    </div>
  );
}