'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { upsertQuickNote, createQuickNoteWithAttachments, deleteQuickNote, toggleQuickNotePin } from '@/app/actions/quick-note.actions';
import { uploadToCloud } from '@/lib/utils/upload';
import { useQuickNoteSync, QuickNoteSyncPayload } from '@/lib/pusher-client';
import { Plus, FileText, Download, Copy, Check, Loader2, Paperclip, Image as ImageIcon, X, Maximize2, Trash2, Pin, PinOff, Search, Code, Link, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';

export type QuickNoteType = {
  id: string;
  content: string;
  createdAt: Date;
  workspaceId: string;
  isOptimistic?: boolean;
  attachments?: DraftAttachment[] | null;
  isPinned?: boolean;
  category?: 'PRIMARY' | 'TEMPORARY';
};

export type DraftAttachment = {
  url: string;
  publicId: string;
  fileName: string;
  fileType: string;
};

interface QuickNotesWidgetProps {
  initialNotes: QuickNoteType[];
  workspaceId: string;
}

// ─── Attachment Renderer ──────────────────────────────────────────────────────

const SingleAttachment = ({ attachment }: { attachment: DraftAttachment }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mdContent, setMdContent] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const isImage = attachment.fileType?.startsWith('image/');
  const isPdf = attachment.fileType === 'application/pdf';
  const isMarkdown = attachment.fileName?.endsWith('.md') || attachment.fileType === 'text/markdown';

  useEffect(() => {
    if (isExpanded) {
      if (isMarkdown && !mdContent) {
        fetch(attachment.url)
          .then(res => res.text())
          .then(text => setMdContent(text))
          .catch(err => console.error('Failed to load markdown', err));
      } else if (isPdf && !pdfUrl) {
        fetch(attachment.url)
          .then(res => res.blob())
          .then(blob => {
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(pdfBlob);
            setPdfUrl(objectUrl);
          })
          .catch(err => console.error('Failed to load pdf', err));
      }
    }
  }, [isExpanded, isMarkdown, isPdf, attachment.url, mdContent, pdfUrl]);

  const handleCopyImage = async () => {
    try {
      const response = await fetch(attachment.url);
      let blob = await response.blob();

      // Browsers only support image/png for clipboard write
      if (blob.type !== 'image/png') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
              if (b) resolve(b);
              else reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
          });
        }
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Failed to download file:', err);
      // Fallback: open in new tab
      window.open(attachment.url, '_blank');
    }
  };

  if (isImage) {
    return (
      <>
        <div className="group/img relative rounded-lg overflow-hidden max-w-[320px] border border-white/5">
          <img
            src={attachment.url}
            alt={attachment.fileName || 'Attachment'}
            className="w-full max-h-[250px] object-cover object-top rounded-lg"
            draggable
          />
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
              title="Expand image"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={handleCopyImage}
              className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
              title="Copy to clipboard"
            >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {isExpanded && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8" style={{ zIndex: 9999 }}>
          <div 
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsExpanded(false)}
          />
          <div className="relative w-full h-full flex items-center justify-center group/modal pointer-events-none">
            <img 
              src={attachment.url} 
              alt={attachment.fileName || 'Expanded image'}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl relative z-10 pointer-events-auto"
            />
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 z-20 p-3 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all opacity-0 group-hover/modal:opacity-100 pointer-events-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  return (
    <>
      <div 
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.download-btn')) return;
          if (isPdf || isMarkdown) {
            setIsExpanded(true);
          } else {
            handleDownload(e);
          }
        }}
        className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#2A2A2A]/60 border border-white/5 hover:bg-[#2A2A2A] hover:border-white/10 transition-all group/file max-w-[320px] cursor-pointer"
        title={isPdf || isMarkdown ? "Click to view" : "Click to download"}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[13px] text-foreground/80 truncate">{attachment.fileName || 'File'}</p>
            <p className="text-[10px] text-foreground/30 uppercase">{attachment.fileType?.split('/')[1] || 'file'}</p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="download-btn p-2 -mr-2 rounded-md hover:bg-white/10 transition-colors text-foreground/30 hover:text-foreground/80 shrink-0 opacity-0 group-hover/file:opacity-100 focus:opacity-100"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (isPdf || isMarkdown) && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8" style={{ zIndex: 9999 }}>
          <div 
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsExpanded(false)}
          />
          <div className="relative w-full max-w-4xl h-full max-h-[85vh] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col z-10">
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <h3 className="text-foreground/80 font-medium truncate pr-4">{attachment.fileName}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-foreground/50 hover:text-foreground/90"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-foreground/50 hover:text-foreground/90"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-0 bg-white/5 flex flex-col relative">
              {isPdf ? (
                pdfUrl ? (
                  <object 
                    data={pdfUrl + '#toolbar=0'} 
                    type="application/pdf"
                    className="w-full h-full rounded-b-xl bg-white border-0"
                  >
                    <div className="flex flex-col items-center justify-center h-full text-foreground/50 gap-4 bg-white/5 p-6 text-center">
                      <p>Your browser doesn't support native PDF rendering.</p>
                      <button onClick={handleDownload} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-white text-sm">Download PDF instead</button>
                    </div>
                  </object>
                ) : (
                  <div className="flex items-center justify-center h-full text-foreground/50">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Loading PDF...
                  </div>
                )
              ) : isMarkdown ? (
                <div className="prose prose-invert prose-sm sm:prose-base max-w-none overflow-y-auto custom-scrollbar p-6">
                  {mdContent ? (
                    <ReactMarkdown>{mdContent}</ReactMarkdown>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-foreground/50">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Loading markdown...
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const AttachmentView = ({ note }: { note: QuickNoteType }) => {
  const attachments = (note.attachments as DraftAttachment[] | null | undefined) || [];
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, idx) => (
        <SingleAttachment key={idx} attachment={att} />
      ))}
    </div>
  );
};

const DraftAttachmentItem = ({ 
  draft, 
  idx, 
  onRenameDraft, 
  onClearDraft 
}: { 
  draft: DraftAttachment; 
  idx: number; 
  onRenameDraft?: (index: number, newName: string) => void;
  onClearDraft?: (index: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const lastDotIndex = draft.fileName.lastIndexOf('.');
  const hasExtension = lastDotIndex !== -1 && lastDotIndex !== 0;
  const nameWithoutExt = hasExtension ? draft.fileName.slice(0, lastDotIndex) : draft.fileName;
  const ext = hasExtension ? draft.fileName.slice(lastDotIndex) : '';

  const handleRename = (newName: string) => {
    onRenameDraft?.(idx, newName + ext);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  return (
    <div className="relative group/draft w-fit">
      {draft.fileType.startsWith('image/') ? (
        <div className="flex flex-col gap-1">
          <img src={draft.url} alt="Draft" className="h-16 w-auto rounded-lg object-cover border border-white/10" />
          <div className="flex items-center bg-transparent border-b border-transparent focus-within:border-white/20 transition-all w-full max-w-[100px]">
            {isEditing ? (
              <input
                autoFocus
                type="text"
                value={nameWithoutExt}
                onChange={(e) => handleRename(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={handleKeyDown}
                className="text-[10px] bg-transparent text-foreground/90 outline-none truncate w-full placeholder:text-foreground/30"
                placeholder="Rename..."
              />
            ) : (
              <span 
                onDoubleClick={() => setIsEditing(true)}
                className="text-[10px] text-foreground/50 hover:text-foreground/80 cursor-text truncate w-full"
                title="Double click to rename"
              >
                {nameWithoutExt || 'Rename...'}
              </span>
            )}
            {ext && <span className="text-[10px] text-foreground/30">{ext}</span>}
          </div>
        </div>
      ) : (
        <div 
          onDoubleClick={() => !isEditing && setIsEditing(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 max-w-[160px] cursor-text"
          title="Double click to rename"
        >
          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex items-center bg-transparent border-b border-transparent focus-within:border-white/20 transition-all flex-1 min-w-0">
            {isEditing ? (
              <input
                autoFocus
                type="text"
                value={nameWithoutExt}
                onChange={(e) => handleRename(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={handleKeyDown}
                className="text-xs bg-transparent text-foreground/90 outline-none truncate w-full placeholder:text-foreground/30"
                placeholder="Rename..."
              />
            ) : (
              <span className="text-xs text-foreground/80 truncate w-full">
                {nameWithoutExt || 'Rename...'}
              </span>
            )}
            {ext && <span className="text-xs text-foreground/30">{ext}</span>}
          </div>
        </div>
      )}
      <button
        onClick={() => onClearDraft?.(idx)}
        className="absolute -top-2 -right-2 p-1 bg-[#2A2A2A] border border-white/10 rounded-full text-foreground/40 hover:text-white transition-colors opacity-0 group-hover/draft:opacity-100 shadow-xl"
        title="Remove attachment"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

// ─── NoteBlock ─────────────────────────────────────────────────────────────────

const NoteBlock = ({
  note,
  workspaceId,
  isFirst,
  onUpdate,
  onEnterPress,
  onFileUpload,
  shouldFocus,
  isUploading,
  draftAttachments,
  onClearDraft,
  onRenameDraft,
  onDelete,
  onTogglePin,
  isSearchMode,
  searchQuery,
  onSearchQueryChange,
  onToggleSearch,
  activeCategory,
  composerRightElement
}: {
  note: QuickNoteType;
  workspaceId: string;
  isFirst: boolean;
  onUpdate: (id: string, content: string, attachments?: DraftAttachment[], category?: 'PRIMARY' | 'TEMPORARY') => void;
  onEnterPress: () => void;
  onFileUpload: (file: File) => void;
  shouldFocus?: boolean;
  isUploading?: boolean;
  draftAttachments?: DraftAttachment[];
  onClearDraft?: (index: number) => void;
  onRenameDraft?: (index: number, newName: string) => void;
  onDelete?: (id: string, noteSnapshot: QuickNoteType) => void;
  onTogglePin?: (id: string) => void;
  isSearchMode?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onToggleSearch?: () => void;
  activeCategory?: 'PRIMARY' | 'TEMPORARY';
  composerRightElement?: React.ReactNode;
}) => {
  const [localContent, setLocalContent] = useState(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (note.isOptimistic && !isNoteEditing) return;
    if (!isNoteEditing) {
      setLocalContent(note.content);
    }
  }, [note.content, note.isOptimistic, isNoteEditing]);

  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [shouldFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    onUpdate(note.id, val);
  };

  const handleSubmitComposer = async () => {
    if (isSubmitting || isSearchMode) return;

    // Only save if there's text or attachments
    if (localContent.trim() !== '' || (draftAttachments && draftAttachments.length > 0)) {
      setIsSubmitting(true);
      const categoryToSave = (isFirst ? activeCategory : note.category) || 'PRIMARY';
      // Lock the attachments into local React state immediately so they render for the sender
      onUpdate(note.id, localContent, draftAttachments, categoryToSave);

      try {
        if (draftAttachments && draftAttachments.length > 0) {
          onUpdate(note.id, localContent, draftAttachments, categoryToSave);
          await createQuickNoteWithAttachments(note.id, localContent, draftAttachments, categoryToSave);
        } else {
          onUpdate(note.id, localContent, undefined, categoryToSave);
          await upsertQuickNote(note.id, localContent, undefined, categoryToSave);
        }
        setLocalContent('');
        onEnterPress();
      } catch (error) {
        console.error(error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComposer();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) onFileUpload(file);
        return;
      }
    }
  };

  const handleNoteEditSave = async () => {
    setIsNoteEditing(false);
    if (localContent !== originalContent) {
      setIsSubmitting(true);
      try {
        await upsertQuickNote(note.id, localContent, undefined, note.category || activeCategory || 'PRIMARY');
        setOriginalContent(localContent);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDoubleClick = () => {
    let start = localContent.length;
    let end = localContent.length;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      start = range.startOffset;
      end = range.endOffset;
    }
    
    setOriginalContent(localContent);
    setIsNoteEditing(true);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
      }
    }, 0);
  };

  const handleNoteEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNoteEditSave();
    }
  };

  const confirmDelete = async () => {
    setIsConfirmingDelete(false);
    onDelete?.(note.id, note);
    try {
      await deleteQuickNote(note.id);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Drag and drop handlers (composer only)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(f => onFileUpload(f));
    }
  };

  if (isFirst) {
    return (
      <div className="w-full mb-4 relative animate-in fade-in zoom-in-95 duration-300">
        <div
          className={`flex items-start gap-3 w-full pb-2 transition-all border-b-2 ${
            isDragging
              ? 'border-accent/50 bg-accent/5 p-4 rounded-t-xl'
              : 'border-border/50 focus-within:border-accent/40 bg-transparent'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-center gap-1.5 mt-[2px]">
            <button
              onClick={onToggleSearch}
              className={`p-1.5 rounded-md transition-colors ${isSearchMode ? 'bg-accent/20 text-accent ring-1 ring-accent/30' : 'text-foreground/50 hover:text-foreground/80 hover:bg-hover'}`}
              title={isSearchMode ? "Exit search" : "Search notes"}
            >
              <Search className="w-4 h-4" />
            </button>
            {!isSearchMode && (
              <button
                onClick={() => !isUploading && fileInputRef.current?.click()}
                disabled={isUploading}
                className={`p-1.5 rounded-md transition-colors ${isUploading ? 'text-accent cursor-not-allowed' : 'text-foreground/50 hover:text-foreground/80 hover:bg-hover'}`}
                title="Attach file"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files) Array.from(files).forEach(f => onFileUpload(f));
              e.target.value = '';
            }}
          />
          <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center relative">
            {/* Mobile Tabs */}
            <div className="w-full flex justify-end md:hidden pr-2 mb-1">
              {composerRightElement}
            </div>
            
            <div className="w-full relative">
              {draftAttachments && draftAttachments.length > 0 && !isSearchMode && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {draftAttachments.map((draft, idx) => (
                    <DraftAttachmentItem
                      key={idx}
                      draft={draft}
                      idx={idx}
                      onRenameDraft={onRenameDraft}
                      onClearDraft={onClearDraft}
                    />
                  ))}
                </div>
              )}
              <TextareaAutosize
                ref={textareaRef}
                value={isSearchMode ? searchQuery : localContent}
                onChange={(e) => {
                  if (isSearchMode) {
                    onSearchQueryChange?.(e.target.value);
                  } else {
                    handleChange(e);
                  }
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isSearchMode ? 'Search notes...' : (isDragging ? 'Drop file here...' : 'Jot something down...')}
                className="w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed text-foreground/90 placeholder:text-foreground/50 custom-scrollbar mt-1.5 md:pr-0 pb-1"
                style={{ paddingRight: (!isSearchMode && (localContent.trim() !== '' || (draftAttachments && draftAttachments.length > 0))) ? '40px' : '0' }}
              />
              
              {/* Mobile Submit Button */}
              {!isSearchMode && (localContent.trim() !== '' || (draftAttachments && draftAttachments.length > 0)) && (
                <button
                  onClick={handleSubmitComposer}
                  disabled={isSubmitting}
                  className="absolute right-0 bottom-1 p-1.5 bg-accent text-white rounded-full transition-colors shadow-sm md:hidden"
                  title="Send (Enter)"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 translate-x-[1px]"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
                </button>
              )}
            </div>
            
            {isSearchMode && searchQuery && (
              <button
                onClick={() => onSearchQueryChange?.('')}
                className="absolute right-0 top-2 p-1 text-foreground/30 hover:text-foreground/60 bg-background/50 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            
            {/* Desktop Tabs */}
            <div className="hidden md:flex ml-2 shrink-0 self-start mt-[4px] flex-col items-end gap-2">
              {composerRightElement}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderActionButtons = (isMobile: boolean) => (
    <>
      {isConfirmingDelete ? (
        <div className={`flex items-center gap-1 p-1 bg-[#1A1A1A] border border-red-500/20 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-right-2 ${isMobile ? '' : 'z-10'}`}>
          <span className="text-[11px] text-red-400/80 font-medium px-2 select-none">Delete?</span>
          <button 
            onClick={confirmDelete}
            className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
            title="Yes, delete"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setIsConfirmingDelete(false)}
            className="p-1 hover:bg-white/10 text-foreground/50 hover:text-foreground rounded transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => onTogglePin?.(note.id)}
            className={`p-2 rounded-md transition-all ${
              note.isPinned 
                ? 'text-blue-400 hover:bg-blue-500/10 opacity-100' 
                : `hover:bg-white/10 text-foreground/30 hover:text-foreground/60 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note'}
          >
            {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsConfirmingDelete(true)}
            className={`p-2 rounded-md hover:bg-red-500/10 text-foreground/30 hover:text-red-400 transition-all focus:opacity-100 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            title="Delete note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="group flex items-start gap-2 w-full relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col items-end w-14 shrink-0 pr-2 pb-6 mt-[-4px]">
        <span className="text-[10px] leading-none font-medium text-foreground/40 select-none">
          {format(new Date(note.createdAt), 'h:mm a')}
        </span>
      </div>
      <div className="flex-1 min-w-0 pb-6 pl-2">
        <div className={`relative inline-flex flex-col rounded-2xl rounded-tl-none px-4 py-3 min-w-[60px] max-w-full ${isNoteEditing ? 'w-full' : ''} bg-card border border-border shadow-sm`}>
          {/* WhatsApp style curved tail */}
          <svg className={`absolute top-0 -left-[10px] w-[10px] h-[16px] text-card`} viewBox="0 0 10 16" fill="currentColor">
            <path d="M10 0H0C5 0 10 5 10 16V0Z" />
          </svg>
          
          {note.isPinned && (
            <div className="flex items-center gap-1 mb-1.5 -mt-0.5">
              <Pin className="w-2.5 h-2.5 text-muted" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Pinned</span>
            </div>
          )}
          
          {note.content && (
            isNoteEditing ? (
              <TextareaAutosize
                ref={textareaRef}
                value={localContent}
                onChange={handleChange}
                onKeyDown={handleNoteEditKeyDown}
                onBlur={handleNoteEditSave}
                autoFocus
                className="w-full bg-transparent resize-none outline-none text-[14px] leading-relaxed text-foreground/90 placeholder:text-muted !overflow-hidden"
              />
            ) : (
              <div 
                onDoubleClick={handleDoubleClick}
                className="w-full bg-transparent text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap cursor-text break-words"
                title="Double click to edit"
              >
                {localContent}
              </div>
            )
          )}
          <AttachmentView note={note} />
        </div>
        
        {/* Mobile Action buttons (below bubble) */}
        <div className="md:hidden flex items-center gap-1 mt-1 -ml-1">
          {renderActionButtons(true)}
        </div>
      </div>

      {/* Desktop Action buttons (absolutely positioned on right) */}
      <div className="hidden md:flex absolute top-0 right-0 items-center gap-0.5">
        {renderActionButtons(false)}
      </div>
    </div>
  );
};



// ─── Main Widget ──────────────────────────────────────────────────────────────

export const QuickNotesWidget = ({ initialNotes, workspaceId }: QuickNotesWidgetProps) => {
  const [notes, setNotes] = useState<QuickNoteType[]>(initialNotes);
  const [composerId, setComposerId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; fileName: string }[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'PRIMARY' | 'TEMPORARY'>('PRIMARY');

  // ── Pusher real-time sync ──────────────────────────────────────────────────
  useQuickNoteSync(workspaceId, {
    onCreated: (payload: QuickNoteSyncPayload) => {
      setNotes(prev => {
        const exists = prev.some(n => n.id === payload.id);
        if (exists) {
          // If it exists, it's likely our own optimistic update. Convert it to a real note.
          return prev.map(n => 
            n.id === payload.id 
              ? { ...n, ...payload, createdAt: new Date(payload.createdAt), isOptimistic: false }
              : n
          );
        }
        // If it doesn't exist, it's a new note from another client.
        return [
          {
            ...payload,
            createdAt: new Date(payload.createdAt),
          },
          ...prev,
        ];
      });
    },
    onUpdated: (payload: QuickNoteSyncPayload) => {
      setNotes(prev => {
        const exists = prev.some(n => n.id === payload.id);
        if (exists) {
          return prev.map(n =>
            n.id === payload.id
              ? { ...n, ...payload, createdAt: new Date(payload.createdAt), isOptimistic: false }
              : n
          );
        }
        return [
          {
            ...payload,
            createdAt: new Date(payload.createdAt),
          },
          ...prev,
        ];
      });
    },
    onDeleted: ({ id }) => {
      setNotes(prev => prev.filter(n => n.id !== id));
    },
  });

  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Composer is the explicitly tracked note ID
  const composerNote = sortedNotes.find(n => n.id === composerId);
  const historyNotes = sortedNotes.filter(n => n.id !== composerId);

  // ── Filtering logic ─────────────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    let filtered = historyNotes;

    // Apply Tab filter
    filtered = filtered.filter(n => {
      if (activeTab === 'PRIMARY') return !n.category || n.category === 'PRIMARY';
      return n.category === 'TEMPORARY';
    });

    // Exclude completely empty ghost notes (content empty, no attachments)
    filtered = filtered.filter(n => {
      const hasContent = n.content.trim() !== '';
      const hasAttachments = Array.isArray(n.attachments) && n.attachments.length > 0;
      return hasContent || hasAttachments;
    });

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n => n.content.toLowerCase().includes(q));
    }

    return filtered;
  }, [historyNotes, searchQuery, activeTab]);

  // ── Pinned notes ────────────────────────────────────────────────────────────
  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.isPinned), [filteredNotes]);

  // ── Group by Date ─────────────────────────────────────────────────────────
  const groupedNotes = useMemo(() => {
    const grouped = filteredNotes.reduce((acc, note) => {
      const date = new Date(note.createdAt);
      const key = format(date, 'MMM d, yyyy');

      if (!acc[key]) acc[key] = [];
      acc[key].push(note);
      return acc;
    }, {} as Record<string, QuickNoteType[]>);
    
    // Remove empty groups
    Object.keys(grouped).forEach(k => {
      if (grouped[k].length === 0) delete grouped[k];
    });
    return grouped;
  }, [filteredNotes]);



  const handleUpdate = (id: string, content: string, attachments?: DraftAttachment[], category?: 'PRIMARY' | 'TEMPORARY') => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content, isOptimistic: true, ...(attachments ? { attachments } : {}), ...(category ? { category } : {}) } : n));
  };

  const handleDelete = async (id: string, noteSnapshot: QuickNoteType) => {
    // Optimistically remove from UI
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      await deleteQuickNote(id);
    } catch (err) {
      console.error('Failed to delete note, restoring:', err);
      // Rollback: re-add the note
      setNotes(prev => [...prev, noteSnapshot]);
    }
  };

  const handleTogglePin = async (id: string) => {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    try {
      await toggleQuickNotePin(id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      // Rollback
      setNotes(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    }
  };

  const handleEnterPress = () => {
    // Clear draft attachments
    setDraftAttachments([]);
    
    const id = uuidv4();
    const newNote: QuickNoteType = {
      id,
      content: '',
      createdAt: new Date(),
      workspaceId,
      isOptimistic: true,
      category: activeTab
    };
    
    setComposerId(id);
    setNotes(prev => [newNote, ...prev]);
    setFocusId(newNote.id);
    
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }, 50);
  };

  const handleFileUpload = async (file: File) => {
    const uploadId = uuidv4();
    setUploadingFiles(prev => [...prev, { id: uploadId, fileName: file.name }]);

    try {
      const result = await uploadToCloud(file);
      
      setDraftAttachments(prev => [...prev, {
        url: result.url,
        publicId: result.publicId,
        fileName: result.fileName || file.name,
        fileType: result.fileType || file.type,
      }]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingFiles(prev => prev.filter(u => u.id !== uploadId));
    }
  };

  // Create initial composer note on mount only
  useEffect(() => {
    const id = uuidv4();
    const newNote: QuickNoteType = {
      id,
      content: '',
      createdAt: new Date(),
      workspaceId,
      isOptimistic: true,
      category: 'PRIMARY' // will be overwritten on save by activeTab
    };
    setComposerId(id);
    setNotes(prev => [newNote, ...prev]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  return (
    <div className="flex flex-col w-full h-[calc(100vh-2rem)] pb-4">
      {/* ── Composer ─────────────────────────────────────────────────────────── */}
      {composerNote && (
        <div className="shrink-0 z-10 pt-1">
          <NoteBlock
            key={composerNote.id}
            note={composerNote}
            workspaceId={workspaceId}
            isFirst={true}
            onUpdate={handleUpdate}
            onEnterPress={handleEnterPress}
            onFileUpload={handleFileUpload}
            shouldFocus={focusId === composerNote.id}
            isUploading={uploadingFiles.length > 0}
            draftAttachments={draftAttachments}
            onClearDraft={(idx) => setDraftAttachments(prev => prev.filter((_, i) => i !== idx))}
            onRenameDraft={(idx, newName) => setDraftAttachments(prev => prev.map((att, i) => i === idx ? { ...att, fileName: newName } : att))}
            isSearchMode={isSearchOpen}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onToggleSearch={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery('');
            }}
            activeCategory={activeTab}
            composerRightElement={
              <div className="flex items-center gap-4 transform scale-[0.8] origin-right">
                <button 
                  onClick={() => setActiveTab('PRIMARY')}
                  className={`text-[10px] font-bold uppercase tracking-wider transition-colors outline-none ${activeTab === 'PRIMARY' ? 'text-foreground' : 'text-muted hover:text-foreground'}`}
                >
                  Vault
                </button>
                <div className="w-px h-3 bg-white/10" />
                <button 
                  onClick={() => setActiveTab('TEMPORARY')}
                  className={`text-[10px] font-bold uppercase tracking-wider transition-colors outline-none ${activeTab === 'TEMPORARY' ? 'text-foreground' : 'text-muted hover:text-foreground'}`}
                >
                  Scratch
                </button>
              </div>
            }
          />
        </div>
      )}


      {/* ── Scrollable Feed ──────────────────────────────────────────────────── */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-y-auto custom-scrollbar relative scroll-smooth pr-2 ${activeTab === 'TEMPORARY' ? 'pt-4' : 'pt-0'}`}
      >
        {/* ── Pinned Shelf ─────────────────────────────────────────────────────── */}
        {pinnedNotes.length > 0 && (
          <div className="shrink-0 mb-4 flex flex-col gap-1">
            {pinnedNotes.map(note => (
              <div
                key={`pinned-${note.id}`}
                className="group/pin flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border shadow-sm hover:border-foreground/20 transition-all cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                onClick={() => {
                  // Scroll to the note in the feed
                  const el = document.getElementById(`note-${note.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <Pin className="w-2.5 h-2.5 text-foreground/40 shrink-0" />
                <span className="text-[12px] text-foreground/70 truncate flex-1">
                  {note.content.split('\n')[0].substring(0, 60) || 'Attachment'}
                  {note.content.split('\n')[0].length > 60 ? '...' : ''}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTogglePin(note.id); }}
                  className="p-1 rounded hover:bg-white/10 text-foreground/30 hover:text-foreground/60 opacity-0 group-hover/pin:opacity-100 transition-all shrink-0"
                  title="Unpin"
                >
                  <PinOff className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {Object.keys(groupedNotes).length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground/30">
            <Search className="w-6 h-6 mb-2" />
            <span className="text-[13px]">No notes match your search</span>
          </div>
        )}

        {Object.entries(groupedNotes).map(([dayLabel, dayNotes]) => {
          const isGroupToday = isToday(new Date(dayNotes[0].createdAt));
          return (
            <div key={dayLabel} className="mb-6">
              {!isGroupToday && (
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-foreground/30">
                    {dayLabel}
                  </span>
                  <div className="h-px bg-white/5 w-12" />
                </div>
              )}
              
              <div className="flex flex-col items-start w-full">
                {dayNotes.map((note) => (
                  <div key={note.id} id={`note-${note.id}`} className="w-full">
                    <NoteBlock
                      note={note}
                      workspaceId={workspaceId}
                      isFirst={false}
                      onUpdate={handleUpdate}
                      onEnterPress={handleEnterPress}
                      onFileUpload={handleFileUpload}
                      shouldFocus={focusId === note.id}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
