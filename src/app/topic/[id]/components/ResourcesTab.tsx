import React, { useState } from 'react';
import { Capture } from '../types';
import { Clock, Image as ImageIcon, Globe, File as FileIcon, Layers } from 'lucide-react';
import { ResourceSearchBar } from './resources/ResourceSearchBar';
import { ResourceFilterPills, ResourceCategory } from './resources/ResourceFilterPills';
import { ResourceRow, ResourceRowProps } from './resources/ResourceRow';
import { ImageCarousel, ImageCardProps } from './resources/ImageCarousel';
import { CaptureCard } from './resources/CaptureCard';
import { ResourceFooter } from './resources/ResourceFooter';
import { ResourcePreviewModal } from './resources/ResourcePreviewModal';

interface ResourcesTabProps {
  resources: Capture[];
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
  const mappedResources = resources.map(res => {
    let uiCategory: 'image' | 'link' | 'file' | 'note' | 'bundle' = 'file';
    let thumbnailUrl = undefined;

    if (res.type === 'NOTE') {
      uiCategory = 'note';
    } else if (res.content) {
      uiCategory = 'bundle';
    } else if (res.attachments && res.attachments.length > 0 && res.attachments[0].url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
      uiCategory = 'image';
      thumbnailUrl = res.attachments[0].url;
    } else if ((res.fileType?.startsWith('image/') || res.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) && !res.attachments?.length) {
      uiCategory = 'image';
      thumbnailUrl = res.url;
    } else if (res.attachments && res.attachments.length > 0) {
      uiCategory = 'file';
    } else if (res.url && (res.url.includes('res.cloudinary.com') || res.url.match(/\.(md|pdf|txt|csv|doc|docx|xls|xlsx|ppt|pptx)$/i))) {
      uiCategory = 'file';
    } else if (res.url) {
      uiCategory = 'link';
    }

    return {
      ...res,
      uiCategory,
      thumbnailUrl
    };
  });

  // Filter based on search query
  const filteredBySearch = mappedResources.filter(r => 
    (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate into buckets
  const notesAndBundles = filteredBySearch.filter(r => r.uiCategory === 'note' || r.uiCategory === 'bundle');
  const images = filteredBySearch.filter(r => r.uiCategory === 'image');
  const links = filteredBySearch.filter(r => r.uiCategory === 'link');
  const files = filteredBySearch.filter(r => r.uiCategory === 'file');

  const recent = filteredBySearch.slice(0, 5);

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
      try {
        domain = new URL(r.url).hostname;
      } catch (e) {
        domain = r.url;
      }
    }
    return {
      id: r.id,
      title: r.title || r.url || 'Untitled',
      url: r.url || '',
      category: r.uiCategory as any,
      addedAt: getRelativeTime(r.createdAt),
      isOnCanvas: activeUrls.includes(r.url || ''),
      thumbnailUrl: r.thumbnailUrl,
      domain,
      fileFormat,
      content: r.content,
      attachments: r.attachments
    };
  };

  const renderItem = (r: any) => {
    if (r.uiCategory === 'note' || r.uiCategory === 'bundle') {
      return (
        <CaptureCard 
          key={r.id} 
          capture={r} 
          onDelete={onDelete} 
          onDragStartSidebarItem={onDragStartSidebarItem} 
          onOpenSplitView={onOpenSplitView}
          onAttachmentClick={(att) => setPreviewResource({ id: att.url, title: att.fileName || 'Attachment', url: att.url, category: 'image', addedAt: getRelativeTime(new Date()), thumbnailUrl: att.url })}
        />
      );
    }
    const rowProps = mapToRowProps(r);
    return (
      <ResourceRow 
        key={r.id} 
        {...rowProps} 
        onClick={() => handleResourceClick(rowProps)} 
        onDelete={onDelete} 
        onRename={onRename} 
        onDragStartSidebarItem={onDragStartSidebarItem} 
        onOpenSplitView={onOpenSplitView} 
        onAttachmentClick={(att) => setPreviewResource({ id: att.url, title: att.fileName || 'Attachment', url: att.url, category: 'image', addedAt: getRelativeTime(new Date()), thumbnailUrl: att.url })} 
      />
    );
  };

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
    <div className="flex flex-col h-full bg-transparent p-4 py-1 text-zinc-200">
      <div className="mb-2">
        <p className="text-xs text-zinc-400 mb-2 mt-2">All the resources attached to this topic.</p>
        <ResourceSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <ResourceFilterPills 
          selectedCategory={selectedCategory} 
          onCategoryChange={setSelectedCategory} 
          counts={{ All: mappedResources.length, Notes: notesAndBundles.length, Images: images.length, Links: links.length, Files: files.length }} 
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
            <div className="flex flex-col gap-2">
              {recent.map(r => renderItem(r))}
            </div>
          </div>
        )}

        {/* NOTES SECTION */}
        {(selectedCategory === 'All' || selectedCategory === 'Notes') && notesAndBundles.length > 0 && (
          <div className="mb-4">
            {renderSectionHeader(<Layers className="w-3.5 h-3.5 text-fuchsia-500" />, `Notes & Bundles (${notesAndBundles.length})`, notesAndBundles.map(l => l.id))}
            <div className="flex flex-col gap-2">
              {notesAndBundles.map(r => renderItem(r))}
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
                title: img.title || 'Untitled',
                addedAt: getRelativeTime(img.createdAt || new Date()),
                thumbnailUrl: img.thumbnailUrl || img.url || '', 
                onClick: () => setPreviewResource({ ...mapToRowProps(img), category: 'image', url: img.thumbnailUrl || img.url || '' }),
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
              {links.map(r => renderItem(r))}
            </div>
          </div>
        )}

        {/* FILES SECTION */}
        {(selectedCategory === 'All' || selectedCategory === 'Files') && files.length > 0 && (
          <div className="mb-4">
            {renderSectionHeader(<FileIcon className="w-3.5 h-3.5 text-blue-500" />, `Files (${files.length})`, files.map(f => f.id))}
            <div className="flex flex-col gap-0.5">
              {files.map(r => renderItem(r))}
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
