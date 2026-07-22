'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper } from '@tiptap/react';
import { Brain, X } from 'lucide-react';

export function ContextPillNode({ node, updateAttributes, selected }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState(node.attrs.label || 'Context Pill');
  const [draftContent, setDraftContent] = useState(node.attrs.content || '');

  // Keep drafts in sync if attributes change externally
  useEffect(() => {
    setDraftLabel(node.attrs.label || 'Context Pill');
    setDraftContent(node.attrs.content || '');
  }, [node.attrs.label, node.attrs.content]);

  // Handle modal save
  const handleSave = () => {
    updateAttributes({
      label: draftLabel.trim() || 'Context Pill',
      content: draftContent.trim(),
    });
    setIsModalOpen(false);
  };

  return (
    <>
      <NodeViewWrapper
        as="span"
        className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 mx-1 rounded-md text-[12px] font-mono cursor-pointer transition-colors select-none ${
          selected
            ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30'
            : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
        onClick={() => setIsModalOpen(true)}
      >
        <Brain className="w-3.5 h-3.5" />
        <span>{node.attrs.label || 'Context Pill'}</span>
      </NodeViewWrapper>

      {isModalOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div 
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="relative bg-sidebar border border-divider/50 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-foreground/40 hover:text-foreground hover:bg-hover p-1.5 rounded-full transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Body */}
              <div className="flex flex-col pt-2 relative">
                <div className="px-5 py-4 border-b border-divider/40">
                  <input
                    type="text"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    placeholder="Label (e.g. ChatGPT Context)..."
                    className="w-full bg-transparent border-none text-[16px] font-medium placeholder:text-foreground/40 text-foreground focus:outline-none leading-relaxed"
                  />
                </div>
                
                <div className="px-5 py-4">
                  <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Paste ChatGPT history or raw text here..."
                    className="w-full h-64 bg-transparent border-none text-[15px] placeholder:text-foreground/30 text-foreground focus:outline-none resize-none font-sans custom-scrollbar leading-relaxed"
                    autoFocus
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 pb-5 pt-2">
                <div className="flex items-center gap-2 text-foreground/40 text-[13px] font-medium">
                  <Brain className="w-4 h-4" />
                  Context Pill
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 text-foreground/50 hover:text-foreground hover:bg-hover rounded-lg transition-colors text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={!draftContent.trim() && !draftLabel.trim()}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-30 shadow-sm"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
