'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, CalendarClock, RefreshCw, Pin, X, Paperclip } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import getCaretCoordinates from 'textarea-caret';
import { generateCaptureAI, createCapture, createCaptureWithFiles, getWorkspaceNoteCategories } from '@/app/actions';
import { getSubjectsWithTopics } from '@/app/actions/subject.actions';
import { uploadToCloud, CloudUploadResult } from '@/lib/utils/upload';
import { toast } from 'sonner';
import { InlineTagDropdown, InlineTagDropdownHandle } from './InlineTagDropdown';
import { LevelSelector, SubjectMini } from './LevelSelector';
import { useParams, usePathname } from 'next/navigation';
import { NoteCategory } from '@prisma/client';
import { parseTaskInput } from '@/lib/utils/smartDateParser';

export function GlobalQuickNoteModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [subjects, setSubjects] = useState<SubjectMini[]>([]);
  
  const pathname = usePathname();
  const params = useParams();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryName, setCategoryName] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isPinned, setIsPinned] = useState(false);
  const [addToSchedule, setAddToSchedule] = useState(false);
  const [reminder, setReminder] = useState<'none' | 'tomorrow' | 'custom'>('none');

  const [isInlineTagOpen, setIsInlineTagOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [caretPosition, setCaretPosition] = useState<{ top: number; left: number; height: number } | null>(null);

  const [explicitType, setExplicitType] = useState<'note' | 'task' | 'link'>('note');
  const [explicitDate, setExplicitDate] = useState<Date | null>(null);

  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineTagRef = useRef<InlineTagDropdownHandle>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFiles, setUploadedFiles] = useState<{file: File, previewUrl: string, isImage: boolean}[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    setUploadedFiles(prev => [...prev, { file, previewUrl, isImage }]);
    // Auto-switch to LINK type if they haven't explicitly set something else
    if (!title && !content && explicitType === 'note') {
      setExplicitType('link');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('application/pdf') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleUpload(file);
        }
      }
    }
  };

  // ── Smart Date Parser ──────────────────────────────────────────────────
  const parsedResult = useMemo(() => parseTaskInput(title), [title]);

  // Global Ctrl+K Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch categories and subjects when modal opens
  useEffect(() => {
    if (isOpen) {
      if (categories.length === 0) {
        getWorkspaceNoteCategories().then(res => {
          if (res.categories) setCategories(res.categories);
        });
      }
      if (subjects.length === 0) {
        getSubjectsWithTopics().then(res => {
          if (res) setSubjects(res as SubjectMini[]);
        });
      }

      // Initialize selected level based on URL
      if (pathname?.includes('/subject/') && params?.id) {
        setSelectedSubjectId(params.id as string);
        setSelectedTopicId(null);
      } else if (pathname?.includes('/topic/') && params?.id) {
        const topicId = params.id as string;
        setSelectedTopicId(topicId);
      } else {
        setSelectedSubjectId(null);
        setSelectedTopicId(null);
      }
    }
  }, [isOpen, pathname, params]);

  // Resolve parent subject once subjects are loaded if we are on a topic page
  useEffect(() => {
    if (selectedTopicId && !selectedSubjectId && subjects.length > 0) {
      const parentSubject = subjects.find(s => s.topics.some(t => t.id === selectedTopicId));
      if (parentSubject) {
        setSelectedSubjectId(parentSubject.id);
      }
    }
  }, [subjects, selectedTopicId, selectedSubjectId]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    } else {
      setTitle('');
      setContent('');
      setCategoryName('');
      setIsInlineTagOpen(false);
      setTagSearchQuery('');
      setExplicitType('note');
      setExplicitDate(null);
      setUploadedFiles([]);
    }
  }, [isOpen]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    const text = newTitle;
    const match = text.match(/#(\w*)$/);
    
    if (match) {
      const query = match[1];
      setTagSearchQuery(query);
      setIsInlineTagOpen(true);
      
      setTimeout(() => {
        try {
          const textareaElement = e.target;
          const caret = getCaretCoordinates(textareaElement, textareaElement.selectionEnd || newTitle.length);
          
          setCaretPosition({
            top: caret.top,
            left: caret.left,
            height: caret.height,
          });
        } catch (err) {}
      }, 0);
    } else {
      setIsInlineTagOpen(false);
    }
  };

  const handleInlineSelectTag = (tag: NoteCategory) => {
    const text = title;
    const match = text.match(/#(\w*)$/);
    if (match) {
      const newText = text.substring(0, match.index) + `#${tag.name} `;
      setTitle(newText);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
    setCategoryName(tag.name);
    setIsInlineTagOpen(false);
    setTagSearchQuery('');
  };

  const handleInlineCreateTag = (tagName: string) => {
    const text = title;
    const match = text.match(/#(\w*)$/);
    if (match) {
      const newText = text.substring(0, match.index) + `#${tagName} `;
      setTitle(newText);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
    setCategoryName(tagName);
    setIsInlineTagOpen(false);
    setTagSearchQuery('');
  };

  const handleGenerateAI = async () => {
    const prompt = title.trim() || content.trim();
    if (!prompt) {
      toast.error('Please type a prompt in the title or content first!');
      return;
    }

    setIsGenerating(true);
    try {
      const categoryNames = categories.map(c => c.name);
      const res = await generateCaptureAI(prompt, categoryNames);
      
      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.data) {
        const generatedTitle = res.data.category 
          ? `${res.data.title} #${res.data.category.toLowerCase()}`
          : res.data.title;
          
        setTitle(generatedTitle || '');
        setContent(res.data.content || '');
        setCategoryName(res.data.category || '');
        toast.success(`Generated using ${res.provider}`);
      }
    } catch (e: any) {
      toast.error('AI Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    let finalTitle = parsedResult.cleanText;
    let finalCategory = categoryName;

    // Extract #tags from title if they exist and no category was explicitly set
    const tagMatches = finalTitle.match(/#\w+/g);
    if (tagMatches && tagMatches.length > 0) {
      if (!finalCategory) {
        finalCategory = tagMatches[0].replace('#', '');
      }
      finalTitle = finalTitle.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
    }

    if (!content.trim() && !finalTitle.trim()) return;
    setIsSaving(true);
    
    // Set reminders based on parse result or toggle
    let finalAddToSchedule = addToSchedule;
    let finalReminder: Date | undefined;
    if (explicitDate) {
      finalReminder = explicitDate;
    } else if (parsedResult.dueDate) {
      finalReminder = parsedResult.dueDate;
    } else if (reminder === 'tomorrow') {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      finalReminder = tmrw;
    }
    
    try {
      setIsSaving(true);
      
      const captureData = {
        title: finalTitle,
        content,
        categoryName: finalCategory,
        subjectId: selectedSubjectId || undefined,
        topicId: selectedTopicId || undefined,
        isPinned,
        addToSchedule: finalAddToSchedule,
        reminder: finalReminder ? finalReminder.toISOString() : undefined,
        explicitDate: explicitDate || undefined,
        explicitType,
      };

      let result;
      if (uploadedFiles.length > 0) {
        setIsUploading(true);
        const formData = new FormData();
        const jsonCaptureData = {
          ...captureData,
          explicitDate: captureData.explicitDate ? captureData.explicitDate.toISOString() : undefined
        };
        formData.append('data', JSON.stringify(jsonCaptureData));
        uploadedFiles.forEach(f => formData.append('files', f.file));
        result = await createCaptureWithFiles(formData);
        setIsUploading(false);
      } else {
        result = await createCapture(captureData);
      }
      
      if (result.error) throw new Error(result.error);
      
      if (result.item) {
        window.dispatchEvent(new CustomEvent('GLOBAL_CAPTURE_CREATED', { detail: { capture: result.item } }));
      }
      
      toast.success(result.isUrl ? 'Link saved!' : 'Note saved!');
      setIsOpen(false);
      
      // Reset states
      setIsPinned(false);
      setAddToSchedule(false);
      setReminder('none');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Highlight Logic for Invisible Overlay ────────────────────────────────
  const renderHighlightedText = () => {
    if (!title) return null;

    const segments = parsedResult?.matchedSegments || [];
    // We also want to highlight tags (#something)
    const tagMatches = title.match(/(#\w+)/g) || [];
    const allHighlights = [...segments, ...tagMatches];

    if (allHighlights.length === 0) {
      return <span className="text-foreground">{title}</span>;
    }

    // Split text by both dates and tags
    const escapedHighlights = allHighlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escapedHighlights.join('|')})`, 'gi');
    const parts = title.split(pattern);

    return parts.map((part, i) => {
      const isDate = segments.some(s => s.toLowerCase() === part.toLowerCase());
      const isTag = tagMatches.some(t => t.toLowerCase() === part.toLowerCase());
      
      if (isDate) {
        return <span key={i} className="bg-indigo-500/20 text-indigo-300 rounded-sm">{part}</span>;
      }
      if (isTag) {
        return <span key={i} className="bg-emerald-500/20 text-emerald-300 rounded-sm">{part}</span>;
      }
      return <span key={i} className="text-foreground">{part}</span>;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 z-[100]"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[25%] left-1/2 -translate-x-1/2 w-full max-w-4xl z-[101] px-4"
          >
            <motion.div
              animate={{ 
                borderColor: isGenerating ? "rgba(99, 102, 241, 0.4)" : "var(--color-divider)",
                boxShadow: isGenerating ? "0 0 30px -5px rgba(99, 102, 241, 0.25)" : "0 20px 40px -10px rgba(0,0,0,0.5)"
              }}
              transition={{ duration: 0.3 }}
              className="bg-sidebar border border-divider rounded-2xl p-3 flex flex-col relative transition-colors duration-200"
            >
              
              {/* Title & Description Input Area */}
              <div 
                className="flex flex-col gap-4 px-3 pt-3 relative"
                onPaste={handlePaste}
              >

                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {uploadedFiles.map((fileObj, idx) => (
                      <React.Fragment key={idx}>
                        {fileObj.isImage ? (
                          <div className="relative w-16 h-16 rounded-md group/img shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileObj.previewUrl} alt="Attached preview" className="w-full h-full object-cover rounded-md shadow-sm border border-divider/50" />
                            <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 p-0.5 bg-sidebar shadow-md border border-divider rounded-full text-foreground/70 hover:text-red-400 opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar border border-divider text-foreground/70 text-[10px] w-fit group">
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{fileObj.file.name || 'Attached file'}</span>
                            <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} className="ml-1 text-foreground/40 hover:text-red-400 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-2 relative">
                  <div ref={inputContainerRef} className="relative flex-1 font-sans text-[15px]">
                    
                    {/* Invisible Overlay Render Layer */}
                    <div 
                      className="absolute top-0 left-0 right-0 font-medium pointer-events-none whitespace-pre-wrap break-words text-transparent p-0 m-0 leading-normal"
                      aria-hidden="true"
                    >
                      {renderHighlightedText()}
                    </div>
                    
                    <style>{`.task-title-input::selection { background-color: rgba(99,102,241,0.4) !important; color: white !important; }`}</style>
                    <TextareaAutosize
                      ref={textareaRef}
                      value={title}
                      placeholder="Ask anything, save a note, or type a date like 'tomorrow'..."
                      onChange={handleTitleChange}
                      onKeyDown={(e) => {
                        if (isInlineTagOpen && inlineTagRef.current?.handleKeyDown(e)) {
                          e.preventDefault();
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      disabled={isGenerating || isSaving}
                      className="task-title-input w-full bg-transparent placeholder:text-foreground/30 focus:outline-none font-medium relative resize-none overflow-hidden block p-0 m-0 border-none leading-normal text-transparent caret-white z-10 pr-8"
                    />
                    
                    <InlineTagDropdown
                      ref={inlineTagRef}
                      isOpen={isInlineTagOpen}
                      searchQuery={tagSearchQuery}
                      categories={categories}
                      onSelectTag={handleInlineSelectTag}
                      onCreateTag={handleInlineCreateTag}
                      onClose={() => setIsInlineTagOpen(false)}
                      caretPosition={caretPosition}
                    />
                  </div>

                  {/* Compact AI Generate Button */}
                  <button
                    onClick={handleGenerateAI}
                    disabled={isGenerating || isSaving || (!title.trim() && !content.trim())}
                    className="flex-shrink-0 flex items-center justify-center w-7 h-7 mt-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors disabled:opacity-50"
                    title="Generate with AI"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Additional Description Textarea (Expands naturally) */}
                <TextareaAutosize
                  placeholder="Add more details (optional)..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  minRows={1}
                  maxRows={12}
                  disabled={isGenerating || isSaving}
                  className="w-full bg-transparent text-[14px] text-foreground/70 placeholder:text-foreground/30 focus:outline-none resize-none disabled:opacity-50 border-none m-0 p-0 leading-relaxed overflow-y-auto custom-scrollbar"
                />
              </div>

              {/* Parsed Date Badge */}
              <AnimatePresence>
                {(explicitDate || parsedResult.dueDate) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="px-2"
                  >
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-medium rounded-md border border-indigo-500/20">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Set for: {(explicitDate || parsedResult.dueDate)!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      <button 
                        onClick={() => {
                          setTitle(parsedResult.cleanText);
                          setExplicitDate(null);
                        }} 
                        className="ml-1 p-0.5 hover:bg-indigo-500/20 rounded-sm transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Actions Row (ChatGPT Style) */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-divider/40 ">
                <div className="flex items-center ">
                  {/* Level Selector */}
                  <LevelSelector 
                    subjects={subjects}
                    selectedSubjectId={selectedSubjectId}
                    selectedTopicId={selectedTopicId}
                    onChange={(sId, tId) => {
                      setSelectedSubjectId(sId);
                      setSelectedTopicId(tId);
                    }}
                  />

                  <div className="flex items-center gap-1 ml-2 pl-2 border-l border-divider/40">
                    <div className="relative">
                      <input 
                        type="date"
                        ref={datePickerRef}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => {
                          if (e.target.value) {
                            setExplicitDate(new Date(e.target.value));
                            setReminder('custom');
                          } else {
                            setExplicitDate(null);
                            setReminder('none');
                          }
                        }}
                      />
                      <button
                        className={`relative p-1.5 rounded-md transition-colors ${explicitDate || reminder !== 'none' || parsedResult.dueDate ? 'text-indigo-400 bg-indigo-500/10' : 'text-foreground/40 hover:text-foreground hover:bg-hover'}`}
                        title="Pick a date"
                      >
                        <CalendarClock className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => setAddToSchedule(s => !s)}
                      className={`p-1.5 rounded-md transition-colors ${addToSchedule ? 'text-green-400 bg-green-500/10' : 'text-foreground/40 hover:text-foreground hover:bg-hover'}`}
                      title="Add to Spaced Repetition Schedule"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setIsPinned(p => !p)}
                      className={`p-1.5 rounded-md transition-colors ${isPinned ? 'text-amber-400 bg-amber-500/10' : 'text-foreground/40 hover:text-foreground hover:bg-hover'}`}
                      title="Pin to top"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUpload(e.target.files[0]);
                          // Clear the input so the same file can be selected again
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-1.5 rounded-md transition-colors ${uploadedFiles.length > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-foreground/40 hover:text-foreground hover:bg-hover'}`}
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Explicit Type Toggles */}
                  <div className="flex items-center  ml-2 p-0.5 rounded-full bg-black/10 dark:bg-white/5 transform scale-[0.8] origin-left">
                    <button
                      onClick={() => setExplicitType('note')}
                      className={`px-3 py-1 rounded-full scale-[0.9] uppercase tracking-[0.1em] transition-all duration-200 ${explicitType === 'note' ? 'bg-background text-foreground font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-foreground/50 hover:text-foreground/90 font-medium'}`}
                    >
                      Note
                    </button>
                    <button
                      onClick={() => setExplicitType('task')}
                      className={`px-3 py-1 rounded-full scale-[0.9] uppercase tracking-[0.1em] transition-all duration-200 ${explicitType === 'task' ? 'bg-background text-foreground font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-foreground/50 hover:text-foreground/90 font-medium'}`}
                    >
                      Task
                    </button>
                    <button
                      onClick={() => setExplicitType('link')}
                      className={`px-3 py-1 rounded-full scale-[0.9] uppercase tracking-[0.1em] transition-all duration-200 ${explicitType === 'link' ? 'bg-background text-foreground font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-foreground/50 hover:text-foreground/90 font-medium'}`}
                    >
                      Resource
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button 
                    onClick={() => setIsOpen(false)}
                    disabled={isGenerating || isSaving}
                    className="px-3 py-1.5 text-foreground/50 hover:text-foreground hover:bg-hover rounded-lg transition-colors text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isGenerating || isSaving || (!content.trim() && !title.trim())}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-30 shadow-sm"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-background" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
