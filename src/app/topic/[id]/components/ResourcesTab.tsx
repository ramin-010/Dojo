import React, { useState } from 'react';
import { TopicResource } from '../types';
import { Clock, Image as ImageIcon, Globe, File as FileIcon, Layers } from 'lucide-react';
import { ResourceSearchBar } from './resources/ResourceSearchBar';
import { ResourceFilterPills, ResourceCategory } from './resources/ResourceFilterPills';
import { ResourceRow, ResourceRowProps } from './resources/ResourceRow';
import { ImageCarousel, ImageCardProps } from './resources/ImageCarousel';
import { ResourceFooter } from './resources/ResourceFooter';
import { ResourcePreviewModal } from './resources/ResourcePreviewModal';

interface ResourcesTabProps {
  resources: TopicResource[];
  topicId?: string;
  activeUrls?: string[];
  onDelete?: (id: string, url: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onRename?: (id: string, newTitle: string) => void;
  onDragStartSidebarItem?: (data: any) => void;
  onOpenSplitView?: (data: any) => void;
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

export function ResourcesTab({ 
  resources, 
  activeUrls = [], 
  onDelete, 
  onDeleteMultiple, 
  onRename,
  onDragStartSidebarItem,
  onOpenSplitView
}: ResourcesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory>('All');
  const [previewResource, setPreviewResource] = useState<ResourceRowProps | null>(null);

  const handleResourceClick = (r: ResourceRowProps) => {
    if (r.category === 'link' && r.url) {
      let finalUrl = r.url;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    } else {
      setPreviewResource(r);
    }
  };

  // Map the real DB resources to the UI format
  const mappedResources: ResourceRowProps[] = resources.map(res => {
    let category: 'image' | 'link' | 'file' = 'file';
    let fileFormat = undefined;
    let thumbnailUrl = undefined;
    let domain = undefined;

    if (res.category === 'image') {
      category = 'image';
      thumbnailUrl = res.url;
    } else if (res.category === 'link' || res.category === 'web' || res.category === 'text') {
      category = 'link';
      try {
        domain = new URL(res.url).hostname;
      } catch (e) {
        domain = res.url;
      }
    } else {
      category = 'file';
      // Basic extension check for format
      const lowerUrl = res.url.toLowerCase();
      if (lowerUrl.endsWith('.pdf')) fileFormat = 'PDF';
      else if (lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls') || lowerUrl.endsWith('.csv')) fileFormat = 'Excel';
      else if (lowerUrl.endsWith('.docx') || lowerUrl.endsWith('.doc')) fileFormat = 'DOCX';
      else if (lowerUrl.endsWith('.md')) fileFormat = 'MD';
      else fileFormat = res.fileType?.toUpperCase() || 'FILE';
    }

    return {
      id: res.id,
      title: res.title,
      url: res.url,
      category,
      addedAt: getRelativeTime(res.createdAt),
      isOnCanvas: activeUrls.includes(res.url),
      thumbnailUrl,
      domain,
      fileFormat
    };
  });

  // Filter based on search query
  const filteredBySearch = mappedResources.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate into buckets
  const images = filteredBySearch.filter(r => r.category === 'image');
  const links = filteredBySearch.filter(r => r.category === 'link');
  const files = filteredBySearch.filter(r => r.category === 'file');

  // We can sort them to find "Recent" (Top 5 newest)
  // Assuming mappedResources are ordered by DB (usually newest first or oldest first).
  // Let's sort explicitly by addedAt? Actually, we lost the Date object in mapping.
  // Better to sort before mapping, but for now we just take the first 5 assuming they are newest.
  const recent = filteredBySearch.slice(0, 5);

  const renderSectionHeader = (icon: React.ReactNode, title: string, itemsForDeletion?: string[]) => (
    <div className="flex items-center justify-between mb-3 mt-6 first:mt-0">
      <div className="flex items-center gap-2 scale-[1] text-foreground font-medium text-sm">
        {icon}
        <span>{title}</span>
      </div>
      {selectedCategory !== 'All' && itemsForDeletion && itemsForDeletion.length > 0 && (
        <button 
          onClick={() => onDeleteMultiple?.(itemsForDeletion)}
          className="text-[10px] scale-[0.9] font-medium text-red-400 hover:text-red-500 transition-colors"
        >
          Delete all
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-sidebar p-4 py-1 text-zinc-200">
      <div className="mb-2">
        <p className="text-xs text-zinc-400 mb-2 mt-2">All the resources attached to this topic.</p>
        <ResourceSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <ResourceFilterPills 
          selectedCategory={selectedCategory} 
          onCategoryChange={setSelectedCategory} 
          counts={{ All: mappedResources.length, Images: images.length, Links: links.length, Files: files.length }} 
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide pb-2">
        
        {mappedResources.length === 0 ? (
          <div className="text-center py-10 opacity-60">
            <Layers className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-[13px] font-medium">No resources yet</p>
            <p className="text-[11px] mt-1">Extract links or images from the canvas to attach them here.</p>
          </div>
        ) : filteredBySearch.length === 0 ? (
          <div className="text-center py-10 opacity-60">
            <p className="text-[13px] font-medium">No resources match your search.</p>
          </div>
        ) : (
          <>
            {/* RECENT SECTION */}
        {(selectedCategory === 'All' && recent.length > 0) && (
          <div className="mb-4">
            {renderSectionHeader(<Clock className="w-3.5 h-3.5 text-muted-foreground" />, 'Recent')}
            <div className="flex flex-col gap-0.5">
              {recent.map(r => <ResourceRow key={r.id} {...r} onClick={() => handleResourceClick(r)} onDelete={onDelete} onRename={onRename} onDragStartSidebarItem={onDragStartSidebarItem} onOpenSplitView={onOpenSplitView} />)}
            </div>
          </div>
        )}

        {/* IMAGES SECTION */}
        {(selectedCategory === 'All' || selectedCategory === 'Images') && images.length > 0 && (
          <div className="mb-4">
            {renderSectionHeader(<ImageIcon className="w-3.5 h-3.5  text-muted-foreground" />, `Images (${images.length})`, images.map(i => i.id))}
            <ImageCarousel 
              images={images.map(img => ({ 
                ...img, 
                thumbnailUrl: img.thumbnailUrl || img.url, 
                onClick: () => setPreviewResource({ ...img, category: 'image', url: img.thumbnailUrl || img.url }),
                onDelete: onDelete,
                onRename: onRename,
                onDragStartSidebarItem,
                onOpenSplitView
              }))} 
            />
          </div>
        )}

        {/* LINKS SECTION */}
        {(selectedCategory === 'All' || selectedCategory === 'Links') && links.length > 0 && (
          <div className="mb-4">
            {renderSectionHeader(<Globe className="w-3.5 h-3.5 text-blue-500" />, `Links (${links.length})`, links.map(l => l.id))}
            <div className="flex flex-col gap-0.5">
              {links.map(r => <ResourceRow key={r.id} {...r} onClick={() => handleResourceClick(r)} onDelete={onDelete} onRename={onRename} onDragStartSidebarItem={onDragStartSidebarItem} onOpenSplitView={onOpenSplitView} />)}
            </div>
          </div>
        )}

        {/* FILES SECTION */}
        {(selectedCategory === 'All' || selectedCategory === 'Files') && files.length > 0 && (
          <div className="mb-4">
            {renderSectionHeader(<FileIcon className="w-3.5 h-3.5 text-blue-500" />, `Files (${files.length})`, files.map(f => f.id))}
            <div className="flex flex-col gap-0.5">
              {files.map(r => <ResourceRow key={r.id} {...r} onClick={() => handleResourceClick(r)} onDelete={onDelete} onRename={onRename} onDragStartSidebarItem={onDragStartSidebarItem} onOpenSplitView={onOpenSplitView} />)}
            </div>
          </div>
        )}
          </>
        )}

      </div>

      {/* <ResourceFooter totalCount={mappedResources.length} /> */}

      <ResourcePreviewModal 
        resource={previewResource} 
        onClose={() => setPreviewResource(null)} 
      />
    </div>
  );
}
