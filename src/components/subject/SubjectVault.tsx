'use client';

import React, { useState } from 'react';
import { FileText, Link as LinkIcon, Plus, BookMarked, Search, MoreVertical } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface CaptureData {
  id: string;
  type: string;
  url: string | null;
  title: string | null;
  content: string | null;
  createdAt: Date;
  category: { name: string } | null;
}

interface SubjectVaultProps {
  subjectId: string;
  captures: CaptureData[];
}

export function SubjectVault({ subjectId, captures }: SubjectVaultProps) {
  const [activeTab, setActiveTab] = useState<'resources' | 'notes'>('resources');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'subject'>('subject');
  
  const subjectResources = captures.filter(c => c.type === 'LINK');
  const subjectQuickNotes = captures.filter(c => c.type === 'NOTE');

  // Mock aggregated data since it's not provided by the API yet
  const aggregatedResources: CaptureData[] = [
    ...subjectResources,
    { id: 'mock1', type: 'LINK', url: 'https://react.dev', title: 'React Documentation (from React Topic)', content: null, category: { name: 'URL' }, createdAt: new Date() },
    { id: 'mock2', type: 'LINK', url: 'https://nextjs.org/docs', title: 'Next.js App Router (from Next Topic)', content: null, category: { name: 'URL' }, createdAt: new Date() }
  ];

  const aggregatedNotes: CaptureData[] = [
    ...subjectQuickNotes,
    { id: 'm1', type: 'NOTE', content: 'Remember to check the useEffect dependency array! (from Hooks Topic)', url: null, title: null, category: null, createdAt: new Date() }
  ];

  const displayedResources = activeSubTab === 'subject' ? subjectResources : aggregatedResources;
  const displayedNotes = activeSubTab === 'subject' ? subjectQuickNotes : aggregatedNotes;

  return (
    <div className="mt-12 bg-sidebar border border-divider rounded-xl overflow-hidden flex flex-col">
      {/* Header & Main Tabs */}
      <div className="flex items-center justify-between border-b border-divider px-6 py-4 bg-background/50">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-accent" /> Subject Vault
        </h2>
        <div className="flex bg-background border border-divider rounded-lg p-1">
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'resources' ? 'bg-sidebar shadow text-foreground' : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            Resources
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'notes' ? 'bg-sidebar shadow text-foreground' : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            Quick Notes
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Sub Tabs & Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-6 border-b border-divider w-full max-w-md">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeSubTab === 'all' ? 'border-accent text-foreground' : 'border-transparent text-foreground/50 hover:text-foreground'
              }`}
            >
              All Topics (Aggregated)
            </button>
            <button
              onClick={() => setActiveSubTab('subject')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeSubTab === 'subject' ? 'border-accent text-foreground' : 'border-transparent text-foreground/50 hover:text-foreground'
              }`}
            >
              Subject Level
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                className="bg-background border border-divider rounded-md pl-9 pr-3 py-1.5 text-sm w-48 focus:outline-none focus:border-accent"
              />
            </div>
            {activeSubTab === 'subject' && (
              <button className="flex items-center gap-1.5 bg-accent hover:bg-accent/80 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> 
                Add {activeTab === 'resources' ? 'Resource' : 'Note'}
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[200px]">
          {activeTab === 'resources' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedResources.length === 0 ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-foreground/40">
                  <LinkIcon className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-sm">No resources found in this view.</p>
                </div>
              ) : (
                displayedResources.map(res => (
                  <div key={res.id} className="p-4 rounded-lg border border-divider bg-background hover:border-accent/30 transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-md">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <button className="text-foreground/30 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-1">{res.title}</h3>
                    <p className="text-xs text-foreground/50 truncate mb-3">{res.url}</p>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-wider">
                      Added {timeAgo(res.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedNotes.length === 0 ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-foreground/40">
                  <FileText className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-sm">No quick notes found in this view.</p>
                </div>
              ) : (
                displayedNotes.map(note => (
                  <div key={note.id} className="p-4 rounded-lg border border-divider bg-[#fffcdd]/5 dark:bg-[#ffeb3b]/5 hover:border-[#ffeb3b]/30 transition-colors group relative">
                    <button className="absolute top-3 right-3 text-foreground/30 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-4 pr-6">
                      {note.content}
                    </p>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-wider">
                      {timeAgo(note.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
