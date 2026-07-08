import React, { useState } from 'react';
import { Pin, Trash2, Columns, Paperclip } from 'lucide-react';
import { Capture } from '../../types';
import { togglePinCapture } from '@/app/actions';
import { toast } from 'sonner';

interface CaptureCardProps {
  capture: Capture;
  onDelete?: (id: string, url: string) => void;
  onDragStartSidebarItem?: (data: any) => void;
  onOpenSplitView?: (data: any) => void;
  onAttachmentClick?: (attachment: { url: string; fileType?: string | null; fileName?: string | null }) => void;
}

export function CaptureCard({
  capture,
  onDelete,
  onDragStartSidebarItem,
  onOpenSplitView,
  onAttachmentClick
}: CaptureCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryName = capture.category?.name || 'Others';
  const displayTitle = capture.title || (capture.content || '').split('\n')[0].slice(0, 50) + ((capture.content || '').length > 50 ? '...' : '');
  const displayContent = capture.title ? capture.content : (capture.content || '').split('\n').slice(1).join('\n') || capture.content;

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStartSidebarItem) {
      onDragStartSidebarItem({ type: capture.type === 'NOTE' ? 'note' : 'resource', id: capture.id, data: capture });
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ type: capture.type === 'NOTE' ? 'note' : 'resource', id: capture.id, data: capture }));
    e.dataTransfer.effectAllowed = 'copy';
  };



  const handleTogglePin = async () => {
    const toastId = toast.loading(capture.isPinned ? 'Unpinning...' : 'Pinning...');
    const result = await togglePinCapture(capture.id, !capture.isPinned);
    if (result.error) {
      toast.error(result.error, { id: toastId });
    } else {
      toast.success(capture.isPinned ? 'Unpinned' : 'Pinned', { id: toastId });
    }
  };

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => onDragStartSidebarItem?.(null)}
      className="group bg-sidebar border border-divider rounded-lg px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-hover"
    >
      {/* Selection Circle (matching TaskActionMenu) */}
      <div className="shrink-0 mt-0.5">
        <div className="w-4 h-4 rounded-full border border-foreground/30 group-hover:border-accent transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-snug text-foreground/90">
          {displayTitle}
        </p>
        
        {displayContent && (
          <p className={`text-[10px] mt-1 whitespace-pre-wrap text-foreground/50 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {displayContent}
          </p>
        )}

        {capture.attachments && capture.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {capture.attachments.map((att, idx) => {
              const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
              return (
                <button 
                  key={idx} 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isImg && onAttachmentClick) {
                      onAttachmentClick(att);
                    } else {
                      window.open(att.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="block relative focus:outline-none"
                >
                  {isImg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={att.url} alt="Attachment" className="w-8 h-8 object-cover rounded-sm border border-divider/50 hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-sidebar border border-divider/50 hover:bg-hover transition-colors">
                      <Paperclip className="w-3 h-3 text-foreground/50" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Metadata & Actions */}
        <div className="flex items-center justify-between mt-1.5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {categoryName !== 'Others' && capture.type !== 'LINK' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                {categoryName}
              </span>
            )}
            {categoryName === 'Others' && capture.type === 'NOTE' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-foreground/10 text-foreground/70 border border-divider font-bold uppercase tracking-wider">
                NOTE
              </span>
            )}
            <span className="text-[10px] text-foreground/40 font-mono">
              {new Date(capture.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mr-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenSplitView?.({ type: capture.type === 'NOTE' ? 'note' : 'resource', id: capture.id, data: capture }); }}
              className="text-foreground/30 hover:text-blue-400 p-1.5 rounded-md hover:bg-foreground/5 transition-all"
              title="Open in Split View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleTogglePin(); }}
              className={`p-1.5 rounded-md hover:bg-foreground/5 transition-all ${capture.isPinned ? 'text-foreground/80' : 'text-foreground/30 hover:text-foreground/80'}`}
              title={capture.isPinned ? "Unpin item" : "Pin item"}
            >
              <Pin className={`w-3.5 h-3.5 ${capture.isPinned ? 'fill-current' : ''}`} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete?.(capture.id, capture.url || ''); }}
              className="text-foreground/30 hover:text-red-400 p-1.5 rounded-md hover:bg-foreground/5 transition-all"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
