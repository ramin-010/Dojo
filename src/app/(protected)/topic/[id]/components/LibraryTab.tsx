import React, { useState, useEffect } from 'react';
import { Capture } from '../types';
import { Search, Pin, Layers, FileText, Globe, Image as ImageIcon } from 'lucide-react';
import { searchGlobalCaptures } from '@/app/actions';
import { ResourceSearchBar } from './resources/ResourceSearchBar';
import { ResourceRow, ResourceRowProps } from './resources/ResourceRow';
import { CaptureCard } from './resources/CaptureCard';

interface LibraryTabProps {
  topicId: string;
  pinnedCaptures: Capture[];
  onDragStartSidebarItem?: (data: any) => void;
  onOpenSplitView?: (data: any) => void;
  onPinCapture?: (captureId: string) => void;
  onUnpinCapture?: (captureId: string) => void;
}

function getRelativeTime(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  return `${Math.floor(diffInDays / 365)}y ago`;
}

export function LibraryTab({
  topicId,
  pinnedCaptures,
  onDragStartSidebarItem,
  onOpenSplitView,
  onPinCapture,
  onUnpinCapture
}: LibraryTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Capture[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || !topicId) {
      setGlobalSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchGlobalCaptures(topicId, searchQuery);
        setGlobalSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, topicId]);

  const mapToRowProps = (r: any): ResourceRowProps => {
    let fileFormat = undefined;
    let domain = undefined;
    if (r.attachments && r.attachments.length > 0) {
      const firstAtt = r.attachments[0];
      const lowerUrl = (firstAtt.url || '').toLowerCase();
      if (lowerUrl.endsWith('.pdf')) fileFormat = 'PDF';
      else if (lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls') || lowerUrl.endsWith('.csv')) fileFormat = 'Excel';
      else if (lowerUrl.endsWith('.docx') || lowerUrl.endsWith('.doc')) fileFormat = 'DOCX';
      else if (lowerUrl.endsWith('.md')) fileFormat = 'MD';
      else fileFormat = firstAtt.fileType ? firstAtt.fileType.toUpperCase() : 'FILE';
    }
    if (r.url) {
      try { domain = new URL(r.url).hostname; } catch (e) { domain = r.url; }
    }
    return {
      id: r.id,
      title: r.title || r.url || 'Untitled',
      url: r.url || '',
      category: r.uiCategory as any,
      addedAt: getRelativeTime(r.createdAt),
      thumbnailUrl: r.thumbnailUrl,
      domain,
      fileFormat,
      content: r.content,
      attachments: r.attachments,
      sourceContext: r.sourceContext,
    };
  };

  const renderItem = (res: any) => {
    // Determine UI category
    let uiCategory: 'image' | 'link' | 'file' | 'note' | 'bundle' = 'file';
    let thumbnailUrl = undefined;
    if (res.type === 'NOTE') uiCategory = 'note';
    else if (res.content) uiCategory = 'bundle';
    else if (res.attachments?.[0]?.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) { uiCategory = 'image'; thumbnailUrl = res.attachments[0].url; }
    else if (res.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) { uiCategory = 'image'; thumbnailUrl = res.url; }
    else if (res.attachments?.length) uiCategory = 'file';
    else if (res.url?.match(/\.(md|pdf|txt|csv|doc|docx|xls|xlsx|ppt|pptx)$/i)) uiCategory = 'file';
    else if (res.url) uiCategory = 'link';

    let sourceContext = 'Workspace';
    if (res.topic?.title) sourceContext = res.topic.title;
    else if (res.subject?.name) sourceContext = res.subject.name;

    const mapped = { ...res, uiCategory, thumbnailUrl, sourceContext };
    const isPinned = pinnedCaptures.some(p => p.id === res.id);

    if (uiCategory === 'note' || uiCategory === 'bundle') {
      return (
        <CaptureCard 
          key={mapped.id} 
          capture={mapped} 
          onDragStartSidebarItem={onDragStartSidebarItem} 
          onOpenSplitView={onOpenSplitView}
          onAttachmentClick={(att) => onOpenSplitView?.({ type: 'resource', id: att.url, data: { ...mapped, url: att.url, category: 'image', title: att.fileName || 'Attachment' } })}
          sourceContext={mapped.sourceContext}
        />
      );
    }

    const rowProps = mapToRowProps(mapped);
    return (
      <ResourceRow 
        key={mapped.id} 
        {...rowProps} 
        onClick={() => {
          if (rowProps.category === 'link' && rowProps.url) {
            let finalUrl = rowProps.url;
            if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
            window.open(finalUrl, '_blank', 'noopener,noreferrer');
          } else {
            onOpenSplitView?.({ type: 'resource', id: mapped.id, data: mapped });
          }
        }} 
        onDragStartSidebarItem={onDragStartSidebarItem} 
        onOpenSplitView={onOpenSplitView} 
      />
    );
  };

  const renderSectionHeader = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0 text-foreground font-medium text-sm">
      {icon}
      <span>{title}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent p-4 py-1 text-zinc-200">
      <div className="mb-2">
        <p className="text-xs text-zinc-400 mb-2 mt-2">Search the global library or view pinned items.</p>
        <ResourceSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide pb-2">
        {searchQuery.trim() ? (
          <div className="mb-4">
            {renderSectionHeader(<Search className="w-3.5 h-3.5 text-blue-400" />, 'Global Library Search')}
            {isSearching ? (
              <div className="text-center py-4 opacity-50 text-xs">Searching globally...</div>
            ) : globalSearchResults.length === 0 ? (
              <div className="text-center py-4 opacity-50 text-xs">No results found.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {globalSearchResults.map(res => (
                  <div key={res.id} className="relative group/libraryitem">
                    {renderItem(res)}
                    <button 
                      onClick={() => {
                        const isPinned = pinnedCaptures.some(p => p.id === res.id);
                        if (isPinned) onUnpinCapture?.(res.id);
                        else onPinCapture?.(res.id);
                      }}
                      className={`absolute right-2 top-2 p-1.5 rounded-md hover:bg-foreground/5 opacity-0 group-hover/libraryitem:opacity-100 transition-all ${pinnedCaptures.some(p => p.id === res.id) ? 'text-blue-400 opacity-100' : 'text-foreground/30 hover:text-blue-400'}`}
                      title={pinnedCaptures.some(p => p.id === res.id) ? "Unpin from topic" : "Pin to topic"}
                    >
                      <Pin className={`w-3.5 h-3.5 ${pinnedCaptures.some(p => p.id === res.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4">
            {renderSectionHeader(<Pin className="w-3.5 h-3.5 text-blue-400 fill-current" />, 'Pinned Items')}
            {pinnedCaptures.length === 0 ? (
              <div className="text-center py-10 opacity-60">
                <Pin className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-[13px] font-medium">No pinned items</p>
                <p className="text-[11px] mt-1 text-balance px-4">Search the library above and pin items to keep them referenced here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pinnedCaptures.map(res => (
                  <div key={res.id} className="relative group/libraryitem">
                    {renderItem(res)}
                    <button 
                      onClick={() => onUnpinCapture?.(res.id)}
                      className="absolute right-2 top-2 p-1.5 rounded-md hover:bg-foreground/5 text-blue-400 opacity-0 group-hover/libraryitem:opacity-100 transition-all"
                      title="Unpin from topic"
                    >
                      <Pin className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
