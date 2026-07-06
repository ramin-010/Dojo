import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Mic, AudioLines, X ,ArrowUp, Target } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { AiImportCropperModal } from '../topic/AiImportCropperModal';
import { toast } from 'sonner';

// Helper component to manage object URLs safely
function ImagePreview({ file, onRemove, onClick }: { file: File; onRemove: () => void; onClick: () => void }) {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div 
      className="relative group w-14 h-14 rounded-xl overflow-hidden border border-divider cursor-pointer shrink-0 shadow-sm"
      onClick={onClick}
    >
      <img src={url} alt="Preview" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }} 
        className="absolute top-1 right-1 bg-black/70 hover:bg-black rounded-full text-zinc-200 hover:text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// In-memory cache to persist state if the user clicks outside and it unmounts
let draftFiles: File[] = [];
let draftText: string = '';
let draftIsMultiline: boolean = false;
let draftTaggedBlockIds: string[] = [];

interface FloatingCommandBarProps {
  onSubmit?: (files: File[], text: string, taggedBlocks?: any[]) => void;
  onCancel?: () => void;
}

export function FloatingCommandBar({ onSubmit, onCancel }: FloatingCommandBarProps) {
  const [files, setFiles] = useState<File[]>(draftFiles);
  const [taggedBlockIds, setTaggedBlockIds] = useState<string[]>(draftTaggedBlockIds);
  const [fileToCrop, setFileToCrop] = useState<{ index: number; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout morphing state
  const [text, setText] = useState(draftText);
  const [isMultiline, setIsMultiline] = useState(draftIsMultiline);
  const isExpanded = files.length > 0 || taggedBlockIds.length > 0 || isMultiline;

  // Sync state to memory cache
  useEffect(() => {
    draftFiles = files;
    draftText = text;
    draftIsMultiline = isMultiline;
    draftTaggedBlockIds = taggedBlockIds;
  }, [files, text, isMultiline, taggedBlockIds]);

  // Event Bus for tracking canvas selection
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  useEffect(() => {
    const handleSelection = (e: any) => setSelectedBlockId(e.detail.selectedBlockId);
    window.addEventListener('CANVAS_SELECTION_CHANGED', handleSelection);
    // Request current selection on mount just in case
    window.dispatchEvent(new CustomEvent('REQUEST_CANVAS_SELECTION'));
    return () => window.removeEventListener('CANVAS_SELECTION_CHANGED', handleSelection);
  }, []);

  // Auto-tag selected block
  useEffect(() => {
    if (selectedBlockId && !taggedBlockIds.includes(selectedBlockId)) {
      setTaggedBlockIds(prev => [...prev, selectedBlockId]);
    }
  }, [selectedBlockId]);

  // Fetch block data for pills
  const [taggedBlocks, setTaggedBlocks] = useState<any[]>([]);
  useEffect(() => {
    if (taggedBlockIds.length > 0) {
      const handleResponse = (e: any) => setTaggedBlocks(e.detail.blocks);
      window.addEventListener('RESPONSE_BLOCK_DATA', handleResponse);
      window.dispatchEvent(new CustomEvent('REQUEST_BLOCK_DATA', { detail: { blockIds: taggedBlockIds } }));
      return () => window.removeEventListener('RESPONSE_BLOCK_DATA', handleResponse);
    } else {
      setTaggedBlocks([]);
    }
  }, [taggedBlockIds]);

  // Handle Escape to cancel/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    let selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    const totalFiles = files.length + selectedFiles.length;
    if (totalFiles > 5) {
      toast.warning(`You can only attach up to 5 images. Limited selection.`);
      selectedFiles = selectedFiles.slice(0, 5 - files.length);
    }
    
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
    }
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (text.trim() === '' && files.length === 0 && taggedBlocks.length === 0) return;
    if (onSubmit) {
      onSubmit(files, text, taggedBlocks);
      // Clear state and cache
      setText('');
      setFiles([]);
      setTaggedBlockIds([]);
      draftText = '';
      draftFiles = [];
      draftTaggedBlockIds = [];
      draftIsMultiline = false;
    }
  };

  const handleCropConfirm = (croppedFiles: File[]) => {
    if (fileToCrop && croppedFiles.length > 0) {
      setFiles(prev => {
        const next = [...prev];
        next[fileToCrop.index] = croppedFiles[0];
        return next;
      });
    }
    setFileToCrop(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedFiles = Array.from(e.clipboardData.files);
    if (pastedFiles.length > 0) {
      const imageFiles = pastedFiles.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      
      e.preventDefault();

      const totalFiles = files.length + imageFiles.length;
      let filesToAdd = imageFiles;
      
      if (totalFiles > 5) {
        toast.warning(`You can only attach up to 5 images. Limited selection.`);
        filesToAdd = imageFiles.slice(0, 5 - files.length);
      }
      
      if (filesToAdd.length > 0) {
        setFiles(prev => [...prev, ...filesToAdd]);
      }
    }
  };

  return (
    <>
      <div className="absolute bottom-8 w-full flex justify-center z-50 pointer-events-none px-4">
        <div 
          className={`w-full max-w-[750px] bg-sidebar/95 backdrop-blur-md border border-divider shadow-[0_8px_30px_rgb(0,0,0,0.5)] pointer-events-auto transition-all duration-300 flex flex-col relative ${
            isExpanded ? 'rounded-[24px] p-3 gap-2' : 'rounded-full p-2 pl-3'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Previews Row (Only visible when expanded/files attached) */}
          {(files.length > 0 || taggedBlocks.length > 0) && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 px-1 custom-scrollbar">
              {files.map((file, i) => (
                <ImagePreview 
                  key={`${file.name}-${i}`} 
                  file={file} 
                  onRemove={() => removeFile(i)} 
                  onClick={() => setFileToCrop({ index: i, file })} 
                />
              ))}
              {taggedBlocks.map((block) => {
                // Strip HTML tags for preview
                const plainText = block.content.replace(/<[^>]*>?/gm, '');
                return (
                  <div key={block.blockId} className="relative group flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl px-3 py-1 h-14 shrink-0 shadow-sm text-xs max-w-[120px]">
                    <span className="truncate w-full text-center flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{plainText || 'Image Block'}</span>
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setTaggedBlockIds(prev => prev.filter(id => id !== block.blockId)); }} 
                      className="absolute top-1 right-1 bg-black/70 hover:bg-black rounded-full text-zinc-200 hover:text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />

          {/* Input Area */}
          <div className={`relative w-full flex ${isExpanded ? 'flex-col' : 'items-center gap-2'}`}>
            
            {/* Inline Left Button (Collapsed) */}
            {!isExpanded && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 mb-0.5 text-foreground/40 hover:text-foreground hover:bg-hover transition-colors rounded-full shrink-0 flex items-center justify-center"
                title="Attach Images"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}

            <TextareaAutosize
              value={text}
              onChange={(e) => setText(e.target.value)}
              onHeightChange={(height) => setIsMultiline(height > 40)}
              minRows={1}
              maxRows={12}
              placeholder="Ask anything..."
              className={`bg-transparent border-none outline-none text-[15px] placeholder:text-foreground/40 text-foreground resize-none custom-scrollbar leading-relaxed ${
                isExpanded ? 'w-full px-2 py-1' : 'flex-1 py-2'
              }`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onPaste={handlePaste}
            />

            {/* Bottom Buttons Row (Expanded) */}
            {isExpanded && (
              <div className="w-full flex justify-between items-center px-1 pt-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover transition-colors rounded-full flex items-center justify-center"
                  title="Attach Images"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={handleSubmit}
                    className="p-2 bg-foreground text-background hover:bg-foreground/90 transition-colors rounded-full flex items-center justify-center"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Inline Right Buttons (Collapsed) */}
            {!isExpanded && (
              <div className="flex items-center gap-1.5 shrink-0 pr-1">
                <button 
                  onClick={handleSubmit}
                  className="p-2 bg-foreground text-background hover:bg-foreground/90 transition-colors rounded-full flex items-center justify-center"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Crop Modal Portal */}
      {fileToCrop && (
        <AiImportCropperModal
          files={[fileToCrop.file]}
          onConfirm={handleCropConfirm}
          onCancel={() => setFileToCrop(null)}
          hideContextInput={true}
        />
      )}
    </>
  );
}
