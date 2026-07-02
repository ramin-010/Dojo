import { MoreHorizontal, Search, FolderOpen, Hash, Columns, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllSubjectsForMention, getAllTopicsInSubjectForMention, addTopicMention } from '@/app/actions';
import { toast } from 'sonner';

export type ContextLink = {
  id: string;
  topicId: string;
  path: string;
  taggedAt: string;
  updatedAt: string;
};

type ContextLinksData = {
  outbound: ContextLink[];
  inbound: ContextLink[];
};

export function TopicLinksTimeline({ 
  topicId,
  subjectId,
  contextLinks, 
  onMentionClick,
  onDeleteMention,
  onDragStartSidebarItem,
  onOpenSplitView,
}: { 
  topicId: string;
  subjectId: string;
  contextLinks: ContextLinksData; 
  onMentionClick: (id: string) => void;
  onDeleteMention?: (id: string, isOutbound: boolean) => void;
  onDragStartSidebarItem?: (data: any) => void;
  onOpenSplitView?: (data: any) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [localLinks, setLocalLinks] = useState(contextLinks);

  const [allSubjects, setAllSubjects] = useState<any[] | null>(null);
  const [topicCaches, setTopicCaches] = useState<Record<string, any[]>>({});

  useEffect(() => {
    setLocalLinks(contextLinks);
  }, [contextLinks]);

  const handleFocus = async () => {
    setIsOpen(true);
    if (!allSubjects) {
      const subjects = await getAllSubjectsForMention();
      setAllSubjects(subjects.map(s => ({ ...s, isSubject: true, title: s.name })));
    }
    if (!topicCaches[subjectId]) {
      const topics = await getAllTopicsInSubjectForMention(subjectId, topicId);
      setTopicCaches(prev => ({ ...prev, [subjectId]: topics }));
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Show entire default list when query is empty
    const currentQuery = query.toLowerCase();
    let res: any[] = [];

    if (query.startsWith('/')) {
      const match = query.match(/^\/([^/]+)\/(.*)$/);
      if (match) {
        const [_, subjName, topicQuery] = match;
        const exactSubject = allSubjects?.find(s => s.title.toLowerCase() === subjName.toLowerCase());
        if (exactSubject) {
          if (topicCaches[exactSubject.id]) {
            res = topicCaches[exactSubject.id].filter(t => 
              t.title.toLowerCase().includes(topicQuery.toLowerCase()) && t.id !== topicId
            );
            setResults(res.slice(0, 15)); // Limit visual results for performance
          } else {
            getAllTopicsInSubjectForMention(exactSubject.id, topicId).then(topics => {
              setTopicCaches(prev => ({ ...prev, [exactSubject.id]: topics }));
            });
          }
        }
      } else {
        const subjQuery = query.substring(1).toLowerCase();
        res = (allSubjects || []).filter(s => s.title.toLowerCase().includes(subjQuery));
        setResults(res);
      }
    } else {
      if (topicCaches[subjectId]) {
        const matchingTopics = topicCaches[subjectId].filter(t => 
          t.title.toLowerCase().includes(currentQuery) && t.id !== topicId
        );
        
        // Include subjects at the bottom of the list for easy cross-subject discoverability
        const matchingSubjects = currentQuery.length === 0 
            ? (allSubjects || []) 
            : (allSubjects || []).filter(s => s.title.toLowerCase().includes(currentQuery));
            
        res = [...matchingTopics.slice(0, 10), ...matchingSubjects.slice(0, 5)];
        setResults(res);
      } else {
        // Fallback fetch if somehow missed in handleFocus
        getAllTopicsInSubjectForMention(subjectId, topicId).then(topics => {
           setTopicCaches(prev => ({ ...prev, [subjectId]: topics }));
        });
      }
    }
  }, [query, allSubjects, topicCaches, subjectId, topicId, isOpen]);

  const handleAddMention = async (targetTopic: any) => {
    if (targetTopic.isSubject) {
      setQuery(`/${targetTopic.title}/`);
      return;
    }
    
    // Check if already linked locally
    const alreadyLinked = localLinks.outbound.some(l => l.topicId === targetTopic.id) || 
                          localLinks.inbound.some(l => l.topicId === targetTopic.id);
    if (alreadyLinked) {
      toast.error('Topic is already linked');
      setQuery('');
      setIsOpen(false);
      return;
    }

    const toastId = toast.loading('Linking topic...');

    // Truth method: wait for server to actually succeed first!
    const result = await addTopicMention(topicId, targetTopic.id);
    
    if (result && result.success) {
      if (result.message === 'Already exists') {
        toast.error('Topic is already linked', { id: toastId });
      } else {
        toast.success('Topic linked successfully', { id: toastId });
        // Then update local UI instantly to avoid next.js 5s render delay
        setLocalLinks(prev => ({
          ...prev,
          outbound: [...prev.outbound, {
            id: result.mention?.id || ('temp-' + Date.now()),
            topicId: targetTopic.id,
            path: targetTopic.subjectId && targetTopic.subjectId !== subjectId 
                ? `${targetTopic.subject?.name || 'Other Subject'} / ${targetTopic.title}` 
                : targetTopic.title,
            taggedAt: 'Just now',
            updatedAt: 'Just now',
          }]
        }));
      }
    } else {
      toast.error(result?.error || 'Failed to link topic', { id: toastId });
    }
    
    setQuery('');
    setIsOpen(false);
    router.refresh();
  };

  const handleDelete = async (id: string, isOutbound: boolean) => {
    // Truth method: we call onDeleteMention first
    if (onDeleteMention) {
      const res = await onDeleteMention(id, isOutbound);
      // Wait, onDeleteMention from props doesn't return anything (void).
      // The API call is inside TopicWorkspace.tsx handleDeleteMention which handles errors.
    }
    setLocalLinks(prev => ({
      outbound: isOutbound ? prev.outbound.filter(l => l.id !== id) : prev.outbound,
      inbound: !isOutbound ? prev.inbound.filter(l => l.id !== id) : prev.inbound,
    }));
  };


  return (
    <div className="pb-4 pt-2">
      <div className="px-5 mb-6">
        <p className="text-xs text-zinc-400 mb-4 mt-1">All the links attached to this topic.</p>
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder="Search topics to link..."
            className="w-full bg-black/20 border border-white/5 rounded-md py-1.5 pl-8 pr-3 text-[13px] text-white/90 placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/10 transition-colors"
          />
        </div>
        
        {isOpen && (
          <div className="absolute left-5 right-5 mt-1 bg-sidebar border border-divider rounded-md shadow-xl overflow-hidden z-20 max-h-[300px] overflow-y-auto">
            {results.length === 0 && query.length > 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No topics found</div>
            ) : results.length === 0 && query.length === 0 && (!topicCaches[subjectId] || topicCaches[subjectId].length === 0) ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading topics...</div>
            ) : (
              results.map((item, index) => (
                <button
                  key={item.id || index}
                  onClick={() => handleAddMention(item)}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <div className="p-1 rounded bg-white/5 text-muted-foreground">
                    {item.isSubject ? <FolderOpen className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/90 font-medium">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {typeof item.subject === 'object' && item.subject?.name 
                        ? item.subject.name 
                        : item.subject || (item.isSubject ? 'Subject' : '')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {localLinks.outbound.length === 0 && localLinks.inbound.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-3">
            <MoreHorizontal className="w-5 h-5 text-muted-foreground/30" />
          </div>
          <p className="text-[13px] font-medium text-foreground/70 tracking-tight">No links yet</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1 max-w-[200px] leading-relaxed">
            Search above or type <span className="font-mono text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded">@</span> in the editor to build connections.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
        {/* LINKED TO (OUTBOUND) */}
        {localLinks.outbound.length > 0 && (
          <div className="relative flex flex-col">
            {/* Single continuous trunk line for entire section */}
            <div style={{ position: 'absolute', left: 24, top: 10, bottom: 40, width: 2, background: '#525252', borderRadius: 1 }} />
            
            <div className="pl-[48px] mb-1 py-1">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Linked To (Outbound)
              </h4>
            </div>
            
            <div className="flex flex-col">
              {localLinks.outbound.map((link, i) => (
                <div 
                  key={link.id} 
                  draggable
                  onDragStart={(e) => {
                    if (onDragStartSidebarItem) {
                      onDragStartSidebarItem({ type: 'topic_link', id: link.topicId, data: link });
                    }
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'topic_link', id: link.topicId, data: link }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDragEnd={() => onDragStartSidebarItem?.(null)}
                  className="relative group cursor-pointer hover:bg-white/[0.03] py-3.5 pr-5 pl-[48px] transition-colors" 
                  onClick={() => onMentionClick(link.topicId)}
                >
                  {/* Horizontal curve branching off the trunk */}
                  <svg style={{ position: 'absolute', left: 25, top: 14 }} width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <path d="M0 0 Q0 9 9 9 L18 9" stroke="#525252" strokeWidth="2" fill="none" />
                  </svg>
                  
                  {/* Dot at end of branch */}
                  <div className="absolute top-[20px] w-[7px] h-[7px] rounded-full bg-blue-500 ring-[3px] ring-background group-hover:ring-zinc-950 transition-colors z-10" style={{ left: 41 }} />

                  <div className="flex-1 flex flex-col gap-1 ml-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-[13px] text-foreground/90 group-hover:text-foreground transition-colors tracking-tight">
                        {link.path}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="text-muted-foreground/50 hover:text-blue-400 transition-colors px-1 py-0.5 rounded scale-[0.9]"
                          onClick={(e) => { e.stopPropagation(); onOpenSplitView?.({ type: 'topic_link', id: link.topicId, data: link }); }}
                          title="Open in Split View"
                        >
                          <Columns className="w-4 h-4" />
                        </button>
                        {onDeleteMention && (
                          <button 
                            className="text-red-500/50 hover:text-red-500 transition-colors px-2 py-0.5 rounded text-[10px] scale-[0.9] font-medium border border-red-500/20 hover:bg-red-500/10"
                            onClick={(e) => { e.stopPropagation(); handleDelete(link.id, true); }}
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground/40 font-medium tracking-wide mt-0.5">
                      Tagged {link.taggedAt} <span className="mx-1.5 opacity-30">•</span> Updated {link.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REFERENCED BY (INBOUND) */}
        {localLinks.inbound.length > 0 && (
          <div className="relative flex flex-col">
            {/* Single continuous trunk line for entire section */}
            <div style={{ position: 'absolute', left: 24, top: 10, bottom: 40, width: 2, background: '#525252', borderRadius: 1 }} />
            
            <div className="pl-[48px] mb-1 py-1">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Referenced By (Inbound)
              </h4>
            </div>
            
            <div className="flex flex-col">
              {localLinks.inbound.map((link, i) => (
                <div 
                  key={link.id} 
                  draggable
                  onDragStart={(e) => {
                    if (onDragStartSidebarItem) {
                      onDragStartSidebarItem({ type: 'topic_link', id: link.topicId, data: link });
                    }
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'topic_link', id: link.topicId, data: link }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDragEnd={() => onDragStartSidebarItem?.(null)}
                  className="relative group cursor-pointer hover:bg-white/[0.03] py-3.5 pr-5 pl-[48px] transition-colors" 
                  onClick={() => onMentionClick(link.topicId)}
                >
                  {/* Horizontal curve branching off the trunk */}
                  <svg style={{ position: 'absolute', left: 25, top: 14 }} width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <path d="M0 0 Q0 9 9 9 L18 9" stroke="#525252" strokeWidth="2" fill="none" />
                  </svg>
                  
                  {/* Dot at end of branch */}
                  <div className="absolute top-[20px] w-[7px] h-[7px] rounded-full bg-emerald-500 ring-[3px] ring-background group-hover:ring-zinc-950 transition-colors z-10" style={{ left: 41 }} />

                  <div className="flex-1 flex flex-col gap-1 ml-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-[13px] text-foreground/90 group-hover:text-foreground transition-colors tracking-tight">
                        {link.path}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="text-muted-foreground/50 hover:text-blue-400 transition-colors px-1 py-0.5 rounded scale-[0.9]"
                          onClick={(e) => { e.stopPropagation(); onOpenSplitView?.({ type: 'topic_link', id: link.topicId, data: link }); }}
                          title="Open in Split View"
                        >
                          <Columns className="w-4 h-4" />
                        </button>
                        {onDeleteMention && (
                          <button 
                            className="text-red-500/50 hover:text-red-500 transition-colors px-2 py-0.5 rounded text-[10px] scale-[0.9] font-medium border border-red-500/20 hover:bg-red-500/10"
                            onClick={(e) => { e.stopPropagation(); handleDelete(link.id, false); }}
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground/40 font-medium tracking-wide mt-0.5">
                      Tagged {link.taggedAt} <span className="mx-1.5 opacity-30">•</span> Updated {link.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
