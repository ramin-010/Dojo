// Place this file at:  src/app/topic/[id]/components/ContextSidebar.tsx
'use client';

import React from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { TopicLinksTimeline } from '../TopicLinksTimeline';
import { SidebarTab, ContextLinks, QuickNoteDisplay } from '../types';

interface ContextSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
  isDragging: boolean;
  onDragHandleMouseDown: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  contextLinks: ContextLinks;
  quickNotes: QuickNoteDisplay[];
  onMentionClick: (topicId: string) => void;
}

export function ContextSidebar({
  isOpen,
  onClose,
  sidebarWidth,
  isDragging,
  onDragHandleMouseDown,
  activeTab,
  onTabChange,
  contextLinks,
  quickNotes,
  onMentionClick,
}: ContextSidebarProps) {
  return (
    <>
      {/* ── Drag Handle ───────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed top-0 bottom-0 cursor-col-resize hover:bg-primary/50 transition-colors z-[60]"
          style={{
            right: `${sidebarWidth}px`,
            width: '4px',
            backgroundColor: isDragging
              ? 'hsl(var(--primary) / 0.5)'
              : 'transparent',
          }}
          onMouseDown={onDragHandleMouseDown}
        />
      )}

      {/* ── Sidebar Panel ─────────────────────────────────────────────────── */}
      <div
        className={`fixed right-0 top-0 bottom-0 bg-sidebar flex flex-col h-full shadow-2xl z-50 overflow-hidden ${
          isDragging ? '' : 'transition-all duration-300 ease-in-out'
        } ${isOpen ? 'border-l border-divider' : 'border-none'}`}
        style={{ width: isOpen ? `${sidebarWidth}px` : '0px' }}
      >
        <div
          style={{
            width: `${sidebarWidth}px`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header & Tabs */}
          <div className="flex flex-col border-b border-divider">
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <h2 className="font-semibold text-foreground text-[15px]">
                Context Panel
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Close Panel"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className="flex px-6 space-x-6">
              {(['links', 'notes', 'resources'] as SidebarTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={`pb-3 text-[13px] font-medium transition-colors relative ${
                    activeTab === tab
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 pb-20">
            {/* ── Links Tab ─────────────────────────────────────────────── */}
            {activeTab === 'links' && (
              <TopicLinksTimeline
                contextLinks={contextLinks}
                onMentionClick={onMentionClick}
              />
            )}

            {/* ── Notes Tab ─────────────────────────────────────────────── */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Notes
                  </h3>
                  <button className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded font-medium transition-colors">
                    + New Note
                  </button>
                </div>

                {quickNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border border-divider bg-background hover:border-accent/50 transition-colors group cursor-pointer"
                    onClick={() => onMentionClick(note.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          note.type === 'topic-same-subject'
                            ? 'bg-blue-500/10 text-blue-500'
                            : note.type === 'topic-diff-subject'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                      >
                        {note.type === 'topic-same-subject'
                          ? 'Direct Note'
                          : note.type === 'topic-diff-subject'
                          ? 'Cross-Subject Note'
                          : 'Subject-Level Note'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {note.date}
                      </span>
                    </div>
                    <div className="text-sm text-foreground mb-3 leading-relaxed">
                      {note.content}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/5 p-1.5 rounded border border-divider/50">
                      <LinkIcon className="w-3 h-3" />
                      <span className="truncate">
                        Linked to:{' '}
                        <span className="font-medium text-foreground/80">
                          {note.linkedItemTitle}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Resources Tab ─────────────────────────────────────────── */}
            {activeTab === 'resources' && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic text-center px-4">
                Resources section coming soon...
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}