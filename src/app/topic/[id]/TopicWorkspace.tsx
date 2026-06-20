'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Clock, Calendar, CheckCircle2, X, Link as LinkIcon, FileText, Globe, ChevronLeft, ChevronRight, Plus, Menu, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { TopicCanvas } from "@/components/canvas/TopicCanvas";
import { TopicLinksTimeline, ContextLink } from './TopicLinksTimeline';
import { updateTopic, completeRevision } from '@/app/actions';
import { timeAgo } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export type SidebarTab = 'links' | 'notes' | 'resources';

interface TopicWorkspaceProps {
  topic: any; // Using any for brevity, it's the full Prisma object with includes
}

export function TopicWorkspace({ topic }: TopicWorkspaceProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('links');
  const [previewTopicId, setPreviewTopicId] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(384); // Default w-96 = 384px

  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tags, setTags] = useState<string[]>(topic.tags || []);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);

  // Derived state for the UI
  const pendingRevision = topic.revisions?.find((r: any) => r.status === 'pending');
  const isRevised = !pendingRevision && topic.revisions?.length > 0;
  
  // Format mentions into ContextLinks
  const contextLinks = {
    outbound: (topic.mentionsOut || []).map((m: any) => ({
      id: m.targetTopic.id,
      path: `${m.targetTopic.subject.name} / ${m.targetTopic.title}`,
      taggedAt: timeAgo(new Date(m.createdAt)),
      updatedAt: timeAgo(new Date(m.targetTopic.updatedAt))
    })),
    inbound: (topic.mentionsIn || []).map((m: any) => ({
      id: m.sourceTopic.id,
      path: `${m.sourceTopic.subject.name} / ${m.sourceTopic.title}`,
      taggedAt: timeAgo(new Date(m.createdAt)),
      updatedAt: timeAgo(new Date(m.sourceTopic.updatedAt))
    }))
  };

  const quickNotes = (topic.quickNotes || []).map((note: any) => ({
    id: note.id,
    type: note.isSubjectLevel ? 'subject' : 'topic-same-subject',
    content: note.content,
    date: timeAgo(new Date(note.createdAt)),
    linkedItemTitle: note.isSubjectLevel ? topic.subject.name : topic.title
  }));

  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 40);
  };
  
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(900);
  const rafRef = useRef<number>(0);
  const resizeRafRef = useRef<number>(0);

  // Measure the actual available width for the canvas area (RAF-throttled)
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        for (const entry of entries) {
          setCanvasContainerWidth(entry.contentRect.width);
        }
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        // Calculate new width from the right edge
        const newWidth = window.innerWidth - e.clientX;
        // Ensure center has at least 500px width (accounting for left sidebar ~64-256px)
        const leftSidebarWidth = document.querySelector('aside')?.offsetWidth || 64;
        const maxAllowedWidth = window.innerWidth - leftSidebarWidth - 500;
        
        const clampedWidth = Math.min(Math.max(newWidth, 250), Math.min(800, maxAllowedWidth));
        setSidebarWidth(clampedWidth);
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    // Add event listeners to the whole document to keep dragging smooth
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Set a class to the body to prevent text selection and keep cursor as col-resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging]);

  // Listen for canvas block drag events to animate the canvas border efficiently
  useEffect(() => {
    const handleCanvasDrag = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDragging: boolean }>;
      const isDraggingBlock = customEvent.detail.isDragging;
      const container = document.getElementById('canvas-border-container');
      const stickyBorder = document.getElementById('canvas-top-sticky-border');
      
      if (container && stickyBorder) {
        if (isDraggingBlock) {
          // Top sticky border gets top/left/right SOLID borders and accent background
          stickyBorder.className = "w-full border-t border-l border-r rounded-t-2xl h-4 mt-2 bg-accent/5 transition-all duration-300";
          stickyBorder.style.borderColor = '#007acc';
          
          // Container gets left/right/bottom dashed borders and accent background
          container.className = "flex-1 w-full relative border-l border-r border-b rounded-b-2xl transition-all duration-300 shadow-sm bg-accent/5 border-dashed";
          container.style.borderColor = 'rgba(0, 122, 204, 0.3)';
        } else {
          // Revert to default states
          stickyBorder.className = "w-full border-t rounded-t-2xl h-4 mt-2 bg-background transition-all duration-300";
          stickyBorder.style.borderColor = '#007acc';
          container.className = "flex-1 w-full relative transition-all duration-300";
          container.style.borderColor = ''; // reset container border color
        }
      }
    };

    window.addEventListener('canvas-drag-state', handleCanvasDrag);
    return () => window.removeEventListener('canvas-drag-state', handleCanvasDrag);
  }, []);

  // Remove old hardcoded contextLinks and quickNotes since they are now derived from props
  
  const handleMarkDone = async () => {
    if (!pendingRevision || isMarkingDone) return;
    setIsMarkingDone(true);
    try {
      await completeRevision(pendingRevision.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMarkingDone(false);
    }
  };

  const handleMentionClick = (clickedTopicId: string) => {
    setPreviewTopicId(clickedTopicId);
    setActiveTab('resources');
    setIsSidebarOpen(true);
    setSidebarWidth(window.innerWidth / 2);
  };

  const fullFadeWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 960;
  const overlayOpacity = isSidebarOpen
    ? Math.min(0.6, Math.max(0, (sidebarWidth - 384) / Math.max(1, fullFadeWidth - 384) * 0.6))
    : 0;

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      {/* Main Content Area */}
      <div 
        className={`flex-1 h-full overflow-y-auto overflow-x-hidden flex flex-col min-w-[500px] relative ${isDragging ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ marginRight: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        onScroll={handleScroll}
      >
        {/* Floating Sidebar Toggle Button */}
        {!isSidebarOpen && (
          <button 
            onClick={() => {
              setIsSidebarOpen(true);
              setSidebarWidth(window.innerWidth / 4);
            }}
            className="fixed top-6 right-6 p-2 bg-background border border-border shadow-sm hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all z-50 animate-in fade-in zoom-in-95"
            title="Open Context Panel"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        
        {/* Dynamic Dark Overlay */}
        {overlayOpacity > 0 && (
          <div 
            className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-75 z-50"
            style={{ opacity: overlayOpacity }}
          />
        )}
        
        <div 
          className="max-w-[960px] min-w-[960px] mx-auto w-full h-full flex flex-col px-8 transition-all duration-300 ease-in-out"
        >
          <div className="pt-6 flex-shrink-0 bg-background z-30">
            {/* Top Utility Row */}
            <div className="flex items-center justify-between">
              <Link 
                href={`/subject/${topic.subject.id}`} 
                className={`inline-flex p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all duration-300 -ml-1.5 ${!isScrolled ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              
              <div className="flex items-center gap-2">
                <Link href={`/subject/${topic.subject.id}`} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors max-w-[150px]">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="truncate">{topic.subject.name}</span>
                </Link>
                <div className="w-px h-3 bg-border/50 mx-1" />
                <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/10 px-2 py-1 rounded-md transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  New Topic
                </button>
              </div>
            </div>
          </div>

          <div className={`flex-shrink-0 sticky top-0 bg-background z-40 transition-all duration-300 ${isScrolled ? 'pt-10' : 'pt-6'}`}>
            <div className="flex flex-col pb-2">
              {/* Title & Metadata Row */}
              <div className="flex flex-col relative">
                {/* Absolutely positioned Tags Area - hovers in the gap above without shifting layout */}
                <div className="absolute -top-4 left-0 flex items-center gap-3 text-[#888888] text-xs font-medium -ml-0.5 z-10">
                  {tags.length === 0 && !isAddingTag && (
                    <span 
                      className="text-[#888888]/50 hover:text-foreground cursor-pointer transition-colors"
                      onClick={() => setIsAddingTag(true)}
                    >
                      Add tags...
                    </span>
                  )}
                  {tags.map((tag) => (
                    <span key={tag} className="hover:text-foreground cursor-pointer transition-colors">
                      {tag}
                    </span>
                  ))}
                  
                  {isAddingTag ? (
                    <input
                      type="text"
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      onBlur={() => {
                        if (newTagText.trim()) {
                          const tag = newTagText.startsWith('#') ? newTagText.trim() : `#${newTagText.trim()}`;
                          if (!tags.includes(tag)) {
                            const newTags = [...tags, tag];
                            setTags(newTags);
                            updateTopic(topic.id, { tags: newTags }).catch(console.error);
                          }
                        }
                        setNewTagText('');
                        setIsAddingTag(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (newTagText.trim()) {
                            const tag = newTagText.startsWith('#') ? newTagText.trim() : `#${newTagText.trim()}`;
                            if (!tags.includes(tag)) {
                              const newTags = [...tags, tag];
                              setTags(newTags);
                              updateTopic(topic.id, { tags: newTags }).catch(console.error);
                            }
                          }
                          setNewTagText('');
                          setIsAddingTag(false);
                        } else if (e.key === 'Escape') {
                          setNewTagText('');
                          setIsAddingTag(false);
                        }
                      }}
                      autoFocus
                      className="bg-transparent border-none outline-none text-foreground p-0 w-24 placeholder:text-[#888888]/50"
                      placeholder="Add tag..."
                    />
                  ) : (
                    <button 
                      onClick={() => setIsAddingTag(true)}
                      className="hover:text-foreground transition-colors" 
                      title="Add tag"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap justify-between items-start gap-4 relative">
                  {/* Scroll-revealed Back Button */}
                  <Link 
                    href={`/subject/${topic.subject.id}`} 
                    className={`absolute -left-10 top-[5px] p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all duration-300 z-20 ${isScrolled ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
                    title="Go back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>

                  <h1 className={`${canvasContainerWidth < 650 ? 'text-2xl' : 'text-3xl'} font-bold text-foreground transition-all duration-300 leading-snug`}>
                    {topic.title}
                  </h1>
                  
                  {/* Full View: Button on Title Row */}
                  {canvasContainerWidth >= 650 && pendingRevision && !isRevised && (
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                      <div className={`transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Saving to local storage" />
                      </div>
                      <button 
                        onClick={handleMarkDone}
                        disabled={isMarkingDone}
                        className="flex items-center gap-1.5 text-xs font-medium text-white hover:bg-emerald-600 bg-emerald-500 px-3 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isMarkingDone ? 'Saving...' : 'Mark as Revised'}
                      </button>
                    </div>
                  )}
                  {canvasContainerWidth >= 650 && isRevised && (
                    <div className="flex items-center gap-2 shrink-0 mt-1 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-md text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Revised
                    </div>
                  )}
                </div>
                
                <div className={`flex flex-wrap ${canvasContainerWidth < 650 ? 'justify-between' : ''} items-center gap-4 text-[13px]`}>
                  <div className="flex flex-wrap items-center gap-4">
                    {pendingRevision ? (
                      <>
                        <span className="flex items-center gap-1.5 text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded-md">
                          <Clock className="w-3.5 h-3.5" /> Cycle {pendingRevision.cycleNumber} Revision
                        </span>
                        <span className={`flex items-center gap-1.5 ${new Date(pendingRevision.scheduledFor) < new Date() ? 'text-red-400' : 'text-muted-foreground/60'}`}>
                          <Calendar className="w-3.5 h-3.5" /> 
                          {new Date(pendingRevision.scheduledFor) < new Date() ? 'Overdue' : 'Due: ' + new Date(pendingRevision.scheduledFor).toLocaleDateString()}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground/60">
                        <Clock className="w-3.5 h-3.5" /> No pending revisions
                      </span>
                    )}
                  </div>

                  {/* Narrow View: Button on Metadata Row */}
                  {canvasContainerWidth < 650 && pendingRevision && !isRevised && (
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                      <div className={`transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Saving to local storage" />
                      </div>
                      <button 
                        onClick={handleMarkDone}
                        disabled={isMarkingDone}
                        className="flex items-center gap-1.5 text-xs font-medium text-white hover:bg-emerald-600 bg-emerald-500 px-3 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isMarkingDone ? 'Saving...' : 'Mark as Revised'}
                      </button>
                    </div>
                  )}
                  {canvasContainerWidth < 650 && isRevised && (
                    <div className="flex items-center gap-2 shrink-0 mt-1 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-md text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Revised
                    </div>
                  )}
                </div>
              </div>
              
            </div>
            
            {/* Sticky Curved Border */}
            <div id="canvas-top-sticky-border" className="w-full border-t rounded-t-2xl h-4 mt-2 bg-background" style={{ borderColor: '#007acc' }} />
          </div>
        
          {/* Topic Canvas */}
          <div 
            id="canvas-border-container" 
            className="flex-1 w-full relative transition-all duration-300"
          >
            <div ref={canvasWrapperRef} className="pb-32 w-full h-full relative ">
              <TopicCanvas 
                topicId={topic.id} 
                initialContent={topic.canvasData ? JSON.stringify(topic.canvasData) : undefined} 
                onMentionClick={handleMentionClick} 
                containerWidth={canvasContainerWidth} 
                onSavingChange={setIsSaving}
                topicUpdatedAt={topic.updatedAt}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Context Panel) */}
      {/* Drag Handle */}
      {isSidebarOpen && (
        <div 
          className="fixed top-0 bottom-0 cursor-col-resize hover:bg-primary/50 transition-colors z-[60]"
          style={{ right: `${sidebarWidth}px`, width: '4px', backgroundColor: isDragging ? 'hsl(var(--primary) / 0.5)' : 'transparent' }}
          onMouseDown={() => setIsDragging(true)}
        />
      )}
      
      <div 
        className={`fixed right-0 top-0 bottom-0 bg-sidebar flex flex-col h-full shadow-2xl z-50 overflow-hidden ${isDragging ? '' : 'transition-all duration-300 ease-in-out'} ${isSidebarOpen ? 'border-l border-divider' : 'border-none'}`}
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
      >
        <div style={{ width: `${sidebarWidth}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Sidebar Header & Tabs */}
          <div className="flex flex-col border-b border-divider">
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <h2 className="font-semibold text-foreground text-[15px]">
                Context Panel
              </h2>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Close Panel"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          
            <div className="flex px-6 space-x-6">
              <button 
                onClick={() => setActiveTab('links')}
                className={`pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'links' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                Links
                {activeTab === 'links' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
              <button 
                onClick={() => setActiveTab('notes')}
                className={`pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'notes' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                Notes
                {activeTab === 'notes' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
              <button 
                onClick={() => setActiveTab('resources')}
                className={`pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'resources' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                Resources
                {activeTab === 'resources' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 pb-20">
            {activeTab === 'links' && <TopicLinksTimeline onMentionClick={handleMentionClick} contextLinks={contextLinks} />}

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
                
                {quickNotes.map((note: any) => (
                  <div key={note.id} className="p-3 rounded-lg border border-divider bg-background hover:border-accent/50 transition-colors group cursor-pointer" onClick={() => handleMentionClick(note.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${note.type === 'topic-same-subject' ? 'bg-blue-500/10 text-blue-500' : note.type === 'topic-diff-subject' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {note.type === 'topic-same-subject' ? 'Direct Note' : note.type === 'topic-diff-subject' ? 'Cross-Subject Note' : 'Subject-Level Note'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{note.date}</span>
                    </div>
                    <div className="text-sm text-foreground mb-3 leading-relaxed">{note.content}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/5 p-1.5 rounded border border-divider/50">
                      <LinkIcon className="w-3 h-3" />
                      <span className="truncate">Linked to: <span className="font-medium text-foreground/80">{note.linkedItemTitle}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic text-center px-4">
                Resources section coming soon...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
