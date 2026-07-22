import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Mic, AudioLines, X ,ArrowUp, Target, Sparkles, ChevronDown, ImageIcon, Brain, FileText } from 'lucide-react';
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
let draftSelectedContext: { text: string; html: string; range: { from: number; to: number }; contextPills?: { label: string; content: string }[] } | null = null;

interface FloatingCommandBarProps {
  onSubmit?: (files: File[], text: string, selectedContext?: { text: string; html: string; range: { from: number; to: number }; contextPills?: { label: string; content: string }[] } | null, actionType?: 'ai' | 'enhance') => void;
  onCancel?: () => void;
}

export function FloatingCommandBar({ onSubmit, onCancel }: FloatingCommandBarProps) {
  const [files, setFiles] = useState<File[]>(draftFiles);
  const [selectedContext, setSelectedContext] = useState(draftSelectedContext);
  const [fileToCrop, setFileToCrop] = useState<{ index: number; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showContextOverlay, setShowContextOverlay] = useState(false);

  // Layout morphing state
  const [text, setText] = useState(draftText);
  const [isMultiline, setIsMultiline] = useState(draftIsMultiline);
  const isExpanded = files.length > 0 || selectedContext !== null || isMultiline;

  // Sync state to memory cache
  useEffect(() => {
    draftFiles = files;
    draftText = text;
    draftIsMultiline = isMultiline;
    draftSelectedContext = selectedContext;
  }, [files, text, isMultiline, selectedContext]);

  // AI Import Context Pipeline (Zero-overhead Pull)
  useEffect(() => {
    const handleResponse = (e: any) => {
      if (e.detail && e.detail.text) {
        setSelectedContext(e.detail);
      } else {
        setSelectedContext(null);
      }
    };
    window.addEventListener('RESPONSE_CURRENT_EDITOR_SELECTION', handleResponse);
    
    // Notify editor that AI bar is open (triggers immediate pull and enables reactive updates)
    window.dispatchEvent(new CustomEvent('AI_BAR_STATE_CHANGED', { detail: { isOpen: true } }));
    
    return () => {
      window.removeEventListener('RESPONSE_CURRENT_EDITOR_SELECTION', handleResponse);
      window.dispatchEvent(new CustomEvent('AI_BAR_STATE_CHANGED', { detail: { isOpen: false } }));
    };
  }, []);

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

  const handleSubmit = (actionType: 'ai' | 'enhance' = 'ai') => {
    if (text.trim() === '' && files.length === 0 && !selectedContext) return;
    if (onSubmit) {
      onSubmit(files, text, selectedContext, actionType);
      // Clear state and cache
      setText('');
      setFiles([]);
      setSelectedContext(null);
      draftText = '';
      draftFiles = [];
      draftSelectedContext = null;
      draftIsMultiline = false;
      setShowContextOverlay(false);
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
        <div className="relative w-full max-w-[750px] flex flex-col items-center">
          
          {/* Context Popover Overlay */}
          {showContextOverlay && selectedContext && (
            <div 
              className="absolute bottom-full mb-3 w-[400px] bg-sidebar border border-divider shadow-[0_12px_40px_rgb(0,0,0,0.5)] rounded-2xl p-4 pointer-events-auto flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-blue-400">
                  <Target className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Highlighted Context</span>
                </div>
                <button onClick={() => setShowContextOverlay(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-full hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-zinc-200 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar font-serif italic opacity-90 pr-2 whitespace-pre-wrap">
                "{selectedContext.text}"
              </div>
              {selectedContext.contextPills && selectedContext.contextPills.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 mt-2 border-t border-white/5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">Attached Context Pills</span>
                  {selectedContext.contextPills.map((pill: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-foreground/60 bg-white/5 rounded-lg px-2.5 py-1.5">
                      <Brain className="w-3 h-3 shrink-0" />
                      <span className="font-medium">{pill.label}</span>
                      <span className="text-foreground/30 ml-auto">{pill.content.length} chars</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div 
            className={`w-full bg-sidebar/95 backdrop-blur-md border border-divider shadow-[0_8px_30px_rgb(0,0,0,0.5)] pointer-events-auto transition-all duration-300 flex flex-col relative ${
              isExpanded ? 'rounded-[24px] p-3 gap-2' : 'rounded-full p-2 pl-3'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Previews Row (Only visible when expanded/files attached) */}
          {(files.length > 0 || selectedContext) && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 px-1 custom-scrollbar">
              {files.map((file, i) => (
                <ImagePreview 
                  key={`${file.name}-${i}`} 
                  file={file} 
                  onRemove={() => removeFile(i)} 
                  onClick={() => setFileToCrop({ index: i, file })} 
                />
              ))}
              {selectedContext && (
                <div 
                  className="relative group flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl px-3 py-1 h-14 shrink-0 shadow-sm text-xs max-w-[200px] cursor-pointer transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowContextOverlay(true); }}
                >
                  <span className="w-full flex items-center gap-1 overflow-hidden">
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-left leading-tight line-clamp-2 w-full break-all whitespace-normal pointer-events-none">
                      ❝ {selectedContext.text} ❞
                    </span>
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedContext(null); setShowContextOverlay(false); }} 
                    className="absolute -top-1.5 -right-1.5 bg-black/70 hover:bg-black rounded-full text-zinc-200 hover:text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
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
            
            {/* Inline Left Buttons (Collapsed) */}
            {!isExpanded && (
              <div className="flex items-center gap-1 shrink-0 mb-0.5">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover transition-colors rounded-full flex items-center justify-center"
                  title="Attach Images"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('REQUEST_SELECT_ALL_CANVAS'))}
                  className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover transition-colors rounded-full flex items-center justify-center"
                  title="Select Entire Canvas"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
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
                  handleSubmit('ai');
                }
              }}
              onPaste={handlePaste}
            />

            {/* Bottom Buttons Row (Expanded) */}
            {isExpanded && (
              <div className="w-full flex justify-between items-center px-1 pt-2">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover transition-colors rounded-full flex items-center justify-center"
                    title="Attach Images"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('REQUEST_SELECT_ALL_CANVAS'))}
                    className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-hover transition-colors rounded-full flex items-center justify-center"
                    title="Select Entire Canvas"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative group z-50">
                  <div className="absolute bottom-full right-0 pb-2 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 ease-out">
                     <button 
                       onClick={() => handleSubmit('enhance')}
                       className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-lg rounded-full px-3 py-1.5 transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
                     >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-semibold">Inject</span>
                     </button>
                  </div>
                  <button 
                    onClick={() => handleSubmit('ai')}
                    className="p-2 bg-foreground text-background hover:bg-foreground/90 hover:scale-105 active:scale-95 transition-all duration-200 rounded-full flex items-center justify-center shadow-md"
                    title="AI Import"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Inline Right Buttons (Collapsed) */}
            {!isExpanded && (
              <div className="flex items-center gap-1.5 shrink-0 pr-1 relative group z-50">
                <div className="absolute bottom-full right-0 pb-2 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 ease-out">
                   <button 
                     onClick={() => handleSubmit('enhance')}
                     className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-lg rounded-full px-3 py-1.5 transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
                   >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-semibold">Inject</span>
                   </button>
                </div>
                <button 
                  onClick={() => handleSubmit('ai')}
                  className="p-2 bg-foreground text-background hover:bg-foreground/90 hover:scale-105 active:scale-95 transition-all duration-200 rounded-full flex items-center justify-center shadow-md"
                  title="AI Import"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
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
