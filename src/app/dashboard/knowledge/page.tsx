'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Hash, Brain, FileText, Zap, Circle } from 'lucide-react';

// ── Mock Data ─────────────────────────────────────────────────────────

const MOCK_TAGS = [
  { id: '1', name: 'imp', count: 12, type: 'urgent', color: '#ef4444' }, // red
  { id: '2', name: 'interview', count: 8, type: 'highlight', color: '#eab308' }, // yellow
  { id: '3', name: 'goodtoknow', count: 24, type: 'info', color: '#3b82f6' }, // blue
  { id: '4', name: 'architecture', count: 5, type: 'normal' },
  { id: '5', name: 'database', count: 9, type: 'normal' },
  { id: '6', name: 'frontend', count: 14, type: 'normal' },
  { id: '7', name: 'backend', count: 11, type: 'normal' },
  { id: '8', name: 'algorithms', count: 6, type: 'normal' },
];

const MOCK_TOPICS = [
  { id: 't1', title: 'Load Balancing Strategies', subject: 'System Design', subjectColor: '#007acc', tags: ['imp', 'architecture'] },
  { id: 't2', title: 'Binary Search Variations', subject: 'DSA Practice', subjectColor: '#8b5cf6', tags: ['interview', 'algorithms'] },
  { id: 't3', title: 'React Compiler Deep Dive', subject: 'Frontend Mastery', subjectColor: '#f97316', tags: ['frontend', 'goodtoknow'] },
  { id: 't4', title: 'CAP Theorem', subject: 'System Design', subjectColor: '#007acc', tags: ['interview', 'backend', 'architecture'] },
];

const MOCK_NOTES = [
  { id: 'n1', snippet: 'Consistent hashing uses a ring to minimize key redistribution when nodes are added or removed.', subject: 'System Design', subjectColor: '#007acc', tags: ['imp', 'architecture'] },
  { id: 'n2', snippet: 'B-Trees are optimized for systems that read and write large blocks of data (like databases).', subject: 'Database Architecture', subjectColor: '#10b981', tags: ['database', 'goodtoknow'] },
];

export default function KnowledgeHubPage() {
  const [selectedTag, setSelectedTag] = useState<string>('imp');
  const [activeTab, setActiveTab] = useState<'topics' | 'notes'>('topics');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter content based on selected tag
  const filteredTopics = MOCK_TOPICS.filter(t => t.tags.includes(selectedTag));
  const filteredNotes = MOCK_NOTES.filter(n => n.tags.includes(selectedTag));

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
            {MOCK_TAGS.map(tag => {
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
            })}
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
                <div 
                  key={topic.id}
                  className="group bg-sidebar border border-divider rounded-xl p-4 hover:border-foreground/20 hover:bg-hover transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Circle className="w-5 h-5 text-foreground/30 group-hover:text-accent transition-colors" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground/90">{topic.title}</span>
                      </div>
                      <p className="text-[11px] text-foreground/40 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topic.subjectColor }} />
                        {topic.subject}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {topic.tags.map(t => (
                      <span key={t} className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${t === selectedTag ? 'bg-foreground/10 border-foreground/20 text-foreground/80' : 'bg-sidebar border-divider text-foreground/40'}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )) : (
                <EmptyState type="topics" tag={selectedTag} />
              )
            )}

            {activeTab === 'notes' && (
              filteredNotes.length > 0 ? filteredNotes.map(note => (
                <div 
                  key={note.id}
                  className="group bg-sidebar border border-divider rounded-xl p-4 hover:border-foreground/20 hover:bg-hover transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-[11px] text-foreground/40 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: note.subjectColor }} />
                      {note.subject}
                    </p>
                    <div className="flex gap-1.5">
                      {note.tags.map(t => (
                        <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded bg-background border border-divider/50 text-foreground/40 uppercase tracking-wider ${t === selectedTag ? 'text-foreground/80 border-foreground/20' : ''}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[13px] text-foreground/80 leading-relaxed font-medium">
                    {note.snippet}
                  </p>
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
