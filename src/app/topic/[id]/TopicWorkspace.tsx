'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Clock, Calendar, CheckCircle2, X, Link as LinkIcon, FileText, Globe, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { TopicCanvas } from "@/components/canvas/TopicCanvas";

export type SidebarTab = 'symlinks' | 'preview' | 'resources';

interface TopicWorkspaceProps {
  topic: {
    id: string;
    title: string;
    subject: string;
    status: string;
    day: number;
    content: string;
  };
}

export function TopicWorkspace({ topic }: TopicWorkspaceProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('symlinks');
  const [previewTopicId, setPreviewTopicId] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(384); // Default w-96 = 384px
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Dummy data for symlinks
  const outboundLinks = [
    { id: 't2', title: 'Client Component Boundaries', subject: 'Next.js Architecture', context: '...because Server Components cannot use hooks like useState, you must use @Client Component Boundaries for interactivity...' }
  ];

  const inboundLinks = [
    { id: 't3', title: 'Data Fetching in Next 15', subject: 'Next.js Architecture', context: '...this pattern works seamlessly with @React Server Components Deep Dive to stream data...' },
    { id: 't4', title: 'Caching Strategies', subject: 'Performance', context: '...similar to how @React Server Components Deep Dive reduces bundle size...' }
  ];

  const resourceLinks = [
    { id: 'r1', title: 'React Docs: Server Components', url: 'https://react.dev/reference/rsc/server-components', tags: ['Official Docs'] },
    { id: 'r2', title: 'Next.js App Router', url: 'https://nextjs.org/docs/app', tags: ['Guide'] }
  ];

  const handleMentionClick = (clickedTopicId: string) => {
    setPreviewTopicId(clickedTopicId);
    setActiveTab('preview');
    setIsSidebarOpen(true);
  };

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      {/* Main Content Area */}
      <div className={`flex-1 h-full overflow-y-auto overflow-x-hidden flex flex-col min-w-[500px] ${isDragging ? '' : 'transition-all duration-300 ease-in-out'}`}>
        <div className="max-w-[960px] mx-auto w-full h-full flex flex-col px-8">
          <div className="pt-8 flex-shrink-0 sticky top-0 bg-background z-40">
            <div className="flex flex-col gap-6 pb-2">
              
              {/* Top Utility Row */}
              <div className="flex items-center justify-between">
                <Link href="/" className="inline-flex p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors -ml-1.5">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors max-w-[150px]">
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="truncate">React Hooks</span>
                  </button>
                  <div className="w-px h-3 bg-border/50 mx-1" />
                  <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/10 px-2 py-1 rounded-md transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    New Topic
                  </button>
                </div>
              </div>

              {/* Title & Metadata Row */}
              <div className="flex flex-col">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <h1 className={`${canvasContainerWidth < 650 ? 'text-2xl' : 'text-3xl'} font-bold text-foreground transition-all duration-300 leading-snug`}>
                    {topic.title}
                  </h1>
                  
                  {/* Full View: Button on Title Row */}
                  {canvasContainerWidth >= 650 && (
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                      <div className={`transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Saving to local storage" />
                      </div>
                      <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 hover:text-foreground hover:bg-accent px-3 py-1.5 rounded-md transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Revised
                      </button>
                    </div>
                  )}
                </div>
                
                <div className={`flex flex-wrap ${canvasContainerWidth < 650 ? 'justify-between' : ''} items-center gap-4 text-[13px]`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded-md">
                      <Clock className="w-3.5 h-3.5" /> Day {topic.day} Revision
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground/60">
                      <Calendar className="w-3.5 h-3.5" /> Next due: Today
                    </span>
                  </div>

                  {/* Narrow View: Button on Metadata Row */}
                  {canvasContainerWidth < 650 && (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Saving to local storage" />
                      </div>
                      <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 hover:text-foreground hover:bg-accent px-3 py-1.5 rounded-md transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Revised
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
            
            {/* Sticky Curved Top Border for the Canvas */}
            <div className="w-full border-t border-divider rounded-t-xl mt-2 pt-4" />
          </div>
        
          {/* Topic Canvas */}
          <div ref={canvasWrapperRef} className="flex-1 w-full relative">
            <div className="pb-32 w-full h-full relative">
              <TopicCanvas 
                topicId={topic.id} 
                initialContent={topic.content} 
                onMentionClick={handleMentionClick} 
                containerWidth={canvasContainerWidth} 
                onSavingChange={setIsSaving}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Context Panel) */}
      {/* Drag Handle */}
      {isSidebarOpen && (
        <div 
          className="w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-30"
          style={{ backgroundColor: isDragging ? 'hsl(var(--primary) / 0.5)' : 'transparent' }}
          onMouseDown={() => setIsDragging(true)}
        />
      )}
      
      <div 
        className={`flex-shrink-0 border-l border-divider bg-sidebar flex flex-col h-full shadow-xl z-20 overflow-hidden ${isDragging ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '48px' }}
      >
        {isSidebarOpen ? (
          <>
            {/* Sidebar Header & Tabs */}
            <div className="flex flex-col border-b border-divider">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  Context Panel
                </h2>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-hover rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  title="Collapse Panel"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            
            <div className="flex px-2 space-x-1 pb-2">
              <button 
                onClick={() => setActiveTab('symlinks')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'symlinks' ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Symlinks
              </button>
              <button 
                onClick={() => setActiveTab('resources')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'resources' ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}`}
              >
                <Globe className="w-3.5 h-3.5" />
                Resources
              </button>
              <button 
                onClick={() => setActiveTab('preview')}
                disabled={!previewTopicId}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-colors ${!previewTopicId ? 'opacity-50 cursor-not-allowed' : ''} ${activeTab === 'preview' ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'symlinks' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <ArrowLeft className="w-3 h-3 text-primary" />
                    Linked To (Outbound)
                  </h3>
                  {outboundLinks.length > 0 ? (
                    <div className="space-y-3">
                      {outboundLinks.map(link => (
                        <div key={link.id} className="p-3 rounded-lg border border-divider bg-background hover:border-accent/50 transition-colors cursor-pointer group" onClick={() => handleMentionClick(link.id)}>
                          <div className="text-xs text-muted-foreground mb-1 font-medium">{link.subject}</div>
                          <div className="font-medium text-sm text-primary group-hover:underline mb-2">{link.title}</div>
                          <div className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed">
                            "{link.context}"
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic px-2">No outbound links.</div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <ArrowLeft className="w-3 h-3 text-orange-400 rotate-180" />
                    Referenced By (Inbound)
                  </h3>
                  {inboundLinks.length > 0 ? (
                    <div className="space-y-3">
                      {inboundLinks.map(link => (
                        <div key={link.id} className="p-3 rounded-lg border border-divider bg-background hover:border-accent/50 transition-colors cursor-pointer group" onClick={() => handleMentionClick(link.id)}>
                          <div className="text-xs text-muted-foreground mb-1 font-medium">{link.subject}</div>
                          <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors mb-2">{link.title}</div>
                          <div className="text-xs text-muted-foreground italic line-clamp-3 leading-relaxed">
                            "{link.context}"
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic px-2">No inbound references yet.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Subject Resources
                  </h3>
                  <button className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded font-medium transition-colors">
                    + Add Link (Ctrl+K)
                  </button>
                </div>
                
                {resourceLinks.map(resource => (
                  <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg border border-divider bg-background hover:border-accent/50 transition-colors group">
                    <div className="font-medium text-sm text-primary group-hover:underline mb-1 line-clamp-1">{resource.title}</div>
                    <div className="text-xs text-muted-foreground truncate mb-2">{resource.url}</div>
                    <div className="flex gap-1">
                      {resource.tags.map(tag => (
                        <span key={tag} className="text-[10px] uppercase tracking-wider bg-hover text-muted-foreground px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </a>
                ))}
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="h-full flex flex-col">
                {previewTopicId ? (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
                    </div>
                    <h1 className="text-xl font-bold text-foreground mb-6">
                      {outboundLinks.find(l => l.id === previewTopicId)?.title || inboundLinks.find(l => l.id === previewTopicId)?.title || "Unknown Topic"}
                    </h1>
                    
                    {/* Dummy Read-Only Preview Content */}
                    <div className="prose prose-sm dark:prose-invert">
                      <p>This is a read-only preview of the linked note.</p>
                      <p>In the actual implementation, this will render the Tiptap JSON content dynamically.</p>
                      <ul>
                        <li>Key concept 1</li>
                        <li>Key concept 2</li>
                      </ul>
                      <blockquote>
                        "This is a dummy blockquote demonstrating the preview UI."
                      </blockquote>
                    </div>
                    
                    <button className="mt-8 w-full py-2 bg-hover hover:bg-accent hover:text-accent-foreground text-foreground rounded-md text-sm font-medium transition-colors border border-divider">
                      Open Full Note
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic text-center px-4">
                    Select a link from the Symlinks tab to preview it here.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
        ) : (
          <div className="flex flex-col items-center py-4 space-y-4 w-full">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-hover rounded-md text-muted-foreground hover:text-foreground transition-colors mb-2"
              title="Expand Context Panel"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="w-6 h-px bg-divider my-2" />

            <button 
              onClick={() => { setActiveTab('symlinks'); setIsSidebarOpen(true); }}
              className={`p-2 rounded-md transition-colors ${activeTab === 'symlinks' ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}`}
              title="Symlinks"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setActiveTab('resources'); setIsSidebarOpen(true); }}
              className={`p-2 rounded-md transition-colors ${activeTab === 'resources' ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}`}
              title="Resources"
            >
              <Globe className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setActiveTab('preview'); setIsSidebarOpen(true); }}
              disabled={!previewTopicId}
              className={`p-2 rounded-md transition-colors ${!previewTopicId ? 'opacity-50 cursor-not-allowed' : ''} ${activeTab === 'preview' ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}`}
              title="Preview"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
