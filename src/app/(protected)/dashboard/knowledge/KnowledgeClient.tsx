'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Hash, Brain, FileText, Zap, Circle, BookOpen } from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  count: number;
  type: string;
  color?: string;
}

interface TopicData {
  id: string;
  title: string;
  subject: string;
  subjectColor: string;
  tags: string[];
}

interface NoteData {
  id: string;
  snippet: string;
  subject: string;
  subjectColor: string;
  tags: string[];
}

interface KnowledgeClientProps {
  initialTags: TagData[];
  initialTopics: TopicData[];
  initialNotes: NoteData[];
}

export default function KnowledgeClient({ initialTags, initialTopics, initialNotes }: KnowledgeClientProps) {
  const [selectedTag, setSelectedTag] = useState<string>(initialTags[0]?.name || '');
  const [activeTab, setActiveTab] = useState<'topics' | 'notes'>('topics');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter content based on selected tag
  const filteredTopics = initialTopics.filter(t => t.tags.includes(selectedTag));
  const filteredNotes = initialNotes.filter(n => n.tags.includes(selectedTag));
  
  // Filter tags based on search
  const visibleTags = initialTags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-8 max-w-[1100px] mx-auto w-full h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              Knowledge Hub
            </h1>
            <p className="text-foreground/50 text-sm mt-1">
              Explore your tags and cross-subject connections
            </p>
          </div>
          
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text"
              placeholder="Search tags or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sidebar border border-divider rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-foreground/30"
            />
          </div>
        </div>
      </header>

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 gap-8">
        
        {/* Section A: Tag Explorer */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-foreground/40" />
            <h2 className="text-sm font-semibold text-foreground/80">Tag Explorer</h2>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {visibleTags.length > 0 ? visibleTags.map(tag => {
              const isSelected = selectedTag === tag.name;
              
              let bgClass = "bg-sidebar hover:bg-hover border-divider/40 text-foreground/70";
              let dotColor = "bg-foreground/20";
              
              if (tag.type !== 'normal' && tag.color) {
                // Special tags get a custom subtle tint on hover or when selected
                dotColor = tag.color;
                bgClass = isSelected 
                  ? "border-transparent text-foreground shadow-sm"
                  : "bg-sidebar hover:bg-sidebar border-divider text-foreground/80";
              } else if (isSelected) {
                bgClass = "bg-foreground text-background border-transparent font-medium shadow-sm";
              }

              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(tag.name)}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[13px] ${bgClass}`}
                  style={isSelected && tag.type !== 'normal' ? { backgroundColor: tag.color } : {}}
                >
                  <span 
                    className="w-1.5 h-1.5 rounded-full transition-colors" 
                    style={{ backgroundColor: isSelected && tag.type !== 'normal' ? '#fff' : dotColor }}
                  />
                  <span>#{tag.name}</span>
                  <span className={`text-[10px] ml-1 opacity-60 font-mono ${isSelected && tag.type !== 'normal' ? 'text-white' : ''}`}>
                    {tag.count}
                  </span>
                </button>
              );
            }) : (
              <p className="text-sm text-foreground/40 italic">No tags found.</p>
            )}
          </div>
        </section>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-divider/40" />

        {/* Section B: Tagged Content */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">
                <span className="text-foreground/40 font-normal mr-1">Items tagged</span>
                #{selectedTag}
              </span>
            </div>
            
            {/* Sleek Tabs */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab('topics')}
                className={`pb-1 text-[13px] font-semibold transition-all relative ${
                  activeTab === 'topics'
                    ? 'text-foreground'
                    : 'text-foreground/40 hover:text-foreground/70'
                }`}
              >
                Topics ({filteredTopics.length})
                {activeTab === 'topics' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`pb-1 text-[13px] font-semibold transition-all relative ${
                  activeTab === 'notes'
                    ? 'text-foreground'
                    : 'text-foreground/40 hover:text-foreground/70'
                }`}
              >
                Quick Notes ({filteredNotes.length})
                {activeTab === 'notes' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-2">
            
            {activeTab === 'topics' && (
              filteredTopics.length > 0 ? filteredTopics.map(topic => (
                <Link 
                  href={`/topic/${topic.id}`}
                  key={topic.id}
                  className="group bg-sidebar border border-divider rounded-lg p-4 transition-colors hover:bg-hover block"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{topic.title}</span>
                        {topic.tags.map(t => (
                          <div key={t} className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2">
                            <span className="text-[10px] text-foreground/40 font-medium">#{t}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">
                        {topic.subject}
                        <span className="text-foreground/20 mx-0.5">•</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-[10px] h-[10px]" /> Topic</span>
                      </p>
                    </div>
                  </div>
                </Link>
              )) : (
                <EmptyState type="topics" tag={selectedTag} />
              )
            )}

            {activeTab === 'notes' && (
              filteredNotes.length > 0 ? filteredNotes.map(note => (
                <div 
                  key={note.id}
                  className="group bg-sidebar border border-divider rounded-lg p-4 transition-colors hover:bg-hover"
                >
                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground/90">Quick Note</span>
                        {note.tags.map(t => (
                          <div key={t} className="flex items-center gap-1.5 ml-2 border-l border-divider/50 pl-2">
                            <span className="text-[10px] text-foreground/40 font-medium">#{t}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-foreground/30 mt-0.5 flex items-center gap-1.5">
                        {note.subject}
                        <span className="text-foreground/20 mx-0.5">•</span>
                        <span className="flex items-center gap-1"><Zap className="w-[10px] h-[10px]" /> Note</span>
                      </p>
                    </div>
                    
                    <p className="text-[13px] text-foreground/70 leading-relaxed whitespace-pre-wrap mt-1">
                      {note.snippet}
                    </p>
                  </div>
                </div>
              )) : (
                <EmptyState type="notes" tag={selectedTag} />
              )
            )}

          </div>
        </section>

      </div>
    </div>
  );
}

function EmptyState({ type, tag }: { type: 'topics' | 'notes', tag: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-sidebar/30 border border-dashed border-divider rounded-xl">
      {type === 'topics' ? <FileText className="w-8 h-8 text-foreground/20 mb-3" /> : <Zap className="w-8 h-8 text-foreground/20 mb-3" />}
      <p className="font-semibold text-foreground/70">No {type} found</p>
      <p className="text-sm text-foreground/40 mt-1">You haven't tagged any {type} with #{tag} yet.</p>
    </div>
  );
}
