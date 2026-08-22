'use client';

import { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { toast } from 'sonner';
import { updateCapture } from '@/app/actions/capture.actions';
import { Loader2 } from 'lucide-react';

export function GlobalEditCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleOpen = (e: any) => {
      setCaptureId(e.detail.captureId);
      setTitle(e.detail.title || '');
      setContent(e.detail.content || '');
      setIsOpen(true);
    };
    
    window.addEventListener('OPEN_EDIT_CAPTURE', handleOpen);
    return () => window.removeEventListener('OPEN_EDIT_CAPTURE', handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
      
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!captureId) return;
    
    setIsSaving(true);
    try {
      const result = await updateCapture(captureId, { title, content });
      if (result.error) throw new Error(result.error);
      
      toast.success('Updated successfully!');
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start pt-[15vh] justify-center p-4">
      {/* Subtle Dark Overlay (No Blur) */}
      <div 
        className="fixed inset-0 bg-black/40"
        onClick={() => setIsOpen(false)}
      />
      
      <div className="relative w-full max-w-3xl bg-sidebar border border-divider rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 flex flex-col gap-3">
          <TextareaAutosize
            ref={textareaRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)..."
            className="w-full bg-transparent text-[15px] font-medium outline-none resize-none placeholder:text-foreground/50 custom-scrollbar text-foreground"
            maxRows={3}
          />
          <TextareaAutosize
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content..."
            className="w-full bg-transparent text-[14px] text-foreground/80 outline-none resize-none placeholder:text-foreground/50 min-h-[60px] custom-scrollbar"
          />
        </div>
        
        <div className="px-3 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 flex items-center gap-1.5 w-fit">
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Editing Capture</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="text-[13px] font-medium text-foreground/60 hover:text-foreground transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-accent/10 text-accent hover:bg-accent/20 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
