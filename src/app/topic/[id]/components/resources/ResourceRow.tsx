import React,{useState} from 'react';
import { MoreVertical, Globe, FileText, FileSpreadsheet, File as FileIcon, Image as ImageIcon } from 'lucide-react';

export interface ResourceRowProps {
  id: string;
  title: string;
  url: string;
  category: 'image' | 'link' | 'file';
  addedAt: string;
  isOnCanvas?: boolean;
  // Specific to Links
  domain?: string;
  // Specific to Files
  fileSize?: string;
  fileFormat?: string;
  // For images
  thumbnailUrl?: string;
  onClick?: () => void;
  onDelete?: (id: string, url: string) => void;
  onRename?: (id: string, newTitle: string) => Promise<void> | void;
}

export function ResourceRow({
  id,
  title,
  url,
  category,
  addedAt,
  isOnCanvas,
  domain,
  fileSize,
  fileFormat,
  thumbnailUrl,
  onClick,
  onDelete,
  onRename,
}: ResourceRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSavingRename, setIsSavingRename] = useState(false);
  
  // Separate basename and extension
  const getParts = (fullTitle: string) => {
    if (category === 'link') return { base: fullTitle, ext: '' };
    const lastDot = fullTitle.lastIndexOf('.');
    if (lastDot > 0 && lastDot < fullTitle.length - 1) { // has a valid extension
      return {
        base: fullTitle.slice(0, lastDot),
        ext: fullTitle.slice(lastDot)
      };
    }
    return { base: fullTitle, ext: '' };
  };

  const { base: initialBase, ext: initialExt } = getParts(title);
  const [editTitle, setEditTitle] = useState(initialBase);
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
  
  const getIcon = () => {
    if (category === 'link') {
      return (
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-blue-500" />
        </div>
      );
    }
    
    if (category === 'file') {
      let icon = <FileIcon className="w-4 h-4 text-white" />
      let bg = "bg-zinc-700/80"; // Default
      
      if (fileFormat === 'PDF') {
        icon = <FileText className="w-4 h-4 text-white" />;
        bg = "bg-[#a62b2b]"; // Deeper red for PDF
      } else if (fileFormat === 'Excel') {
        icon = <FileSpreadsheet className="w-4 h-4 text-white" />;
        bg = "bg-[#185c37]"; // Deeper green for Excel
      } else if (fileFormat === 'DOCX') {
        icon = <FileText className="w-4 h-4 text-white" />;
        bg = "bg-[#2b2b2b]"; // Dark gray for DOCX
      } else if (fileFormat === 'MD') {
        icon = <FileText className="w-4 h-4 text-white" />;
        bg = "bg-[#114b7e]"; // Blueish for MD
      }

      return (
        <div className={`w-8 h-8 rounded-lg ${bg}  flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      );
    }

    // Default Image (with thumbnail if available)
    return (
      <div className="w-8 h-8 rounded-lg bg-zinc-800 overflow-hidden shrink-0 relative flex items-center justify-center border border-zinc-700/50">
        {thumbnailUrl ? (
          <>
            <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
            <div className="absolute bottom-0.5 right-0.5 bg-blue-600 rounded p-[1px]">
              <ImageIcon className="w-2 h-2 text-white" />
            </div>
          </>
        ) : (
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    );
  };

  return (
    <div 
      className="flex items-center gap-2.5 p-2 rounded-xl border border-white/5 bg-black/10 hover:border-white/10 hover:bg-black/20 transition-all group cursor-pointer"
      onClick={onClick}
    >
      {getIcon()}
      
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
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
                className="text-[12px] font-medium text-zinc-200 bg-black/50 border border-blue-500 rounded-l px-1 w-full outline-none disabled:opacity-50"
              />
              {initialExt && (
                <span className="text-[12px] text-zinc-400 bg-black/30 border border-l-0 border-blue-500 rounded-r px-1 py-[1px] whitespace-nowrap">
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
            <span className="text-[12px] font-medium text-zinc-200 truncate">
              {title}
            </span>
          )}
          {isOnCanvas && !isRenaming && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-black/40 text-zinc-400 border border-white/10">
              Canvas
            </span>
          )}
        </div>
        {category === 'link' && domain && (
          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
            {domain}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-500 truncate">
          {category === 'link' && (
            <>
              <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-black/40 text-zinc-300">
                Link
              </span>
              <span>•</span>
              <span>Added {addedAt}</span>
            </>
          )}

          {category === 'file' && (
            <>
              {fileSize && <span>{fileSize}</span>}
              {fileFormat && (
                <span className="px-1 py-0.5 rounded text-[9px] uppercase font-medium bg-black/40 text-zinc-300">
                  {fileFormat}
                </span>
              )}
              <span>•</span>
              <span>Added {addedAt}</span>
            </>
          )}

          {category === 'image' && (
            <>
              <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-black/40 text-zinc-300">
                Image
              </span>
              <span>•</span>
              <span>Added {addedAt}</span>
            </>
          )}
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 rounded-md"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-6 w-32 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl py-1 z-50 flex flex-col overflow-hidden">
            {category !== 'link' && (
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
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete?.(id, url);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
