import React, { useRef } from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';

export interface ImageCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  addedAt: string;
  isOnCanvas?: boolean;
  onClick?: () => void;
  onDelete?: (id: string, url: string) => void;
  onRename?: (id: string, newTitle: string) => Promise<void> | void;
}

function ImageCard({ id, title, thumbnailUrl, addedAt, onClick, onDelete, onRename }: ImageCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [isSavingRename, setIsSavingRename] = React.useState(false);
  
  const getParts = (fullTitle: string) => {
    const lastDot = fullTitle.lastIndexOf('.');
    if (lastDot > 0 && lastDot < fullTitle.length - 1) { 
      return {
        base: fullTitle.slice(0, lastDot),
        ext: fullTitle.slice(lastDot)
      };
    }
    return { base: fullTitle, ext: '' };
  };

  const { base: initialBase, ext: initialExt } = getParts(title);
  const [editTitle, setEditTitle] = React.useState(initialBase);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleRenameSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const finalTitle = editTitle.trim() + initialExt;
    if (editTitle.trim() && finalTitle !== title) {
      setIsSavingRename(true);
      try {
        await onRename?.(id, finalTitle);
      } finally {
        setIsSavingRename(false);
        setIsRenaming(false);
      }
    } else {
      setEditTitle(initialBase);
      setIsRenaming(false);
    }
  };

  return (
    <div 
      className="flex flex-col gap-1.5 min-w-[120px] max-w-[120px] cursor-pointer group relative"
      onClick={onClick}
    >
      <div className="w-full h-20 rounded-lg overflow-hidden border border-white/5 bg-black/10 group-hover:border-white/10 transition-colors relative">
        <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
      </div>

      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" ref={menuRef}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 bg-black/60 hover:bg-black/80 rounded-md text-white backdrop-blur-sm"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-6 w-24 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl py-1 z-50 flex flex-col overflow-hidden">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setIsRenaming(true);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              Rename
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete?.(id, thumbnailUrl); // URL or Thumbnail
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col px-0.5 relative z-0">
        {isRenaming ? (
          <div className="flex items-center w-full relative">
            <input
              autoFocus
              value={editTitle}
              disabled={isSavingRename}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(e);
                if (e.key === 'Escape') {
                  setEditTitle(initialBase);
                  setIsRenaming(false);
                }
              }}
              onBlur={() => {
                if (!isSavingRename) handleRenameSubmit();
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-zinc-200 bg-black/50 border border-blue-500 rounded-l px-1 w-full outline-none disabled:opacity-50"
            />
            {initialExt && (
              <span className="text-[11px] text-zinc-400 bg-black/30 border border-l-0 border-blue-500 rounded-r px-1 py-[1px] whitespace-nowrap">
                {initialExt}
              </span>
            )}
            {isSavingRename && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded z-10">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <span className="text-[11px] font-medium text-zinc-200 truncate">{title}</span>
        )}
        <span className="text-[10px] text-zinc-500">{addedAt}</span>
      </div>
    </div>
  );
}

interface ImageCarouselProps {
  images: ImageCardProps[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/carousel mt-2 mb-4">
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {images.map((img) => (
          <div key={img.id} style={{ scrollSnapAlign: 'start' }}>
            <ImageCard {...img} />
          </div>
        ))}
      </div>
      
      {/* Scroll Right Button */}
      {images.length > 3 && (
        <button 
          onClick={scrollRight}
          className="absolute right-0 top-10 -translate-y-1/2 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-foreground shadow-lg opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-zinc-800"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
