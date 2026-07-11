// Place this file at:  src/app/topic/[id]/components/ContextSidebar.tsx
'use client';

import React from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { TopicLinksTimeline } from '../TopicLinksTimeline';
import { ResourcesTab } from './ResourcesTab';
import { LibraryTab } from './LibraryTab';
import { SidebarTab, ContextLinks, Capture, NoteCategory } from '../types';

interface ContextSidebarProps {
  topicId: string;
  subjectId: string;
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
  isDragging: boolean;
  onDragHandleMouseDown: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  contextLinks: ContextLinks;
  quickNotes: Capture[];
  noteCategories: NoteCategory[];
  resources: Capture[];
  pinnedCaptures?: Capture[];
  activeUrls?: string[];
  onMentionClick: (topicId: string) => void;
  onDeleteResource?: (id: string, url: string) => void;
  onDeleteMultipleResources?: (ids: string[]) => void;
  onRenameResource?: (id: string, newTitle: string) => void;
  onDeleteMention?: (id: string, isOutbound: boolean) => void;
  onDragStartSidebarItem?: (data: any) => void;
  onOpenSplitView?: (data: any) => void;
  onPinCapture?: (captureId: string) => void;
  onUnpinCapture?: (captureId: string) => void;
}

export function ContextSidebar({
  topicId,
  subjectId,
  isOpen,
  onClose,
  sidebarWidth,
  isDragging,
  onDragHandleMouseDown,
  activeTab,
  onTabChange,
  contextLinks,
  quickNotes,
  noteCategories,
  resources,
  pinnedCaptures = [],
  activeUrls = [],
  onMentionClick,
  onDeleteResource,
  onDeleteMultipleResources,
  onRenameResource,
  onDeleteMention,
  onDragStartSidebarItem,
  onOpenSplitView,
  onPinCapture,
  onUnpinCapture,
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
        className={`fixed right-0 top-0 bottom-0 flex flex-col h-full shadow-2xl z-50 overflow-hidden ${
          isDragging ? '' : 'transition-all duration-300 ease-in-out'
        } ${isOpen ? 'border-l border-divider' : 'border-none'}`}
        style={{ 
          width: isOpen ? `${sidebarWidth}px` : '0px',
          backgroundColor: '#191919'
        }}
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
          <div className="flex items-center justify-between px-6 border-b border-divider pt-4">
            <div className="flex space-x-6">
              {(['symlinks', 'resources', 'library'] as SidebarTab[]).map((tab) => (
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
            
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors pb-3"
              title="Close Panel"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar ">
            {/* ── Symlinks Tab ─────────────────────────────────────────────── */}
            {activeTab === 'symlinks' && (
              <TopicLinksTimeline
                topicId={topicId}
                subjectId={subjectId}
                contextLinks={contextLinks}
                onMentionClick={onMentionClick}
                onDeleteMention={onDeleteMention}
                onDragStartSidebarItem={onDragStartSidebarItem}
                onOpenSplitView={onOpenSplitView}
              />
            )}

            {/* ── Resources Tab ─────────────────────────────────────────── */}
            {activeTab === 'resources' && (
              <ResourcesTab 
                resources={[...(resources || []), ...(quickNotes || [])]} 
                activeUrls={activeUrls} 
                onDelete={onDeleteResource}
                onDeleteMultiple={onDeleteMultipleResources}
                onRename={onRenameResource}
                onDragStartSidebarItem={onDragStartSidebarItem}
                onOpenSplitView={onOpenSplitView}
              />
            )}

            {activeTab === 'library' && (
              <LibraryTab 
                topicId={topicId}
                pinnedCaptures={pinnedCaptures}
                onDragStartSidebarItem={onDragStartSidebarItem}
                onOpenSplitView={onOpenSplitView}
                onPinCapture={onPinCapture}
                onUnpinCapture={onUnpinCapture}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}