'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Command, Circle } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { generateQuickNoteAI, createQuickNote, getWorkspaceNoteCategories } from '@/app/actions';
import { getSubjectsWithTopics } from '@/app/actions/subject.actions';
import { toast } from 'sonner';
import { InlineTagDropdown, InlineTagDropdownHandle } from './InlineTagDropdown';
import { LevelSelector, SubjectMini } from './LevelSelector';
import { useParams, usePathname } from 'next/navigation';
import { NoteCategory } from '@prisma/client';

import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Placeholder from '@tiptap/extension-placeholder';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const TagHighlight = Extension.create({
  name: 'tagHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tagHighlight'),
        state: {
          init() { return DecorationSet.empty; },
          apply(tr, set) {
            const decorations: Decoration[] = [];
            tr.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const regex = /(#\w+)/g;
                let match;
                while ((match = regex.exec(node.text)) !== null) {
                  decorations.push(
                    Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
                      class: 'bg-indigo-500/20 text-indigo-300 rounded-sm px-0.5',
                    })
                  );
                }
              }
            });
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

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

  const [isInlineTagOpen, setIsInlineTagOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [caretPosition, setCaretPosition] = useState<{ top: number; left: number; height: number } | null>(null);

  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inlineTagRef = useRef<InlineTagDropdownHandle>(null);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({ placeholder: 'Add a title...', emptyEditorClass: 'is-editor-empty' }),
      TagHighlight,
    ],
    content: title,
    editable: !isGenerating && !isSaving,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setTitle(text);
      handleTitleChange(text, editor);
    },
    editorProps: {
      attributes: {
        class: 'task-title-input flex-1 w-full bg-transparent font-sans text-[15px] font-medium focus:outline-none disabled:opacity-50 resize-none overflow-y-auto caret-white whitespace-pre-wrap break-words min-h-[22px] max-h-[180px] custom-scrollbar text-white',
      },
      handleKeyDown: (view, event) => {
        if (isInlineTagOpen && inlineTagRef.current?.handleKeyDown(event as any)) {
          return true;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSave();
          return true;
        }
        return false;
      }
    }
  });

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
        // For topics, we only have the topicId from the URL. We will find its parent subject from the loaded subjects list.
        const topicId = params.id as string;
        setSelectedTopicId(topicId);
        // Parent subject resolution will happen when `subjects` load, but let's handle it below
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
        editor?.commands.focus();
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
      editor?.commands.setContent('');
      setIsInlineTagOpen(false);
      setTagSearchQuery('');
    }
  }, [isOpen, editor]);

  const handleTitleChange = (newTitle: string, currentEditor: any) => {
    const text = newTitle;
    const match = text.match(/#(\w*)$/);
    
    if (match) {
      setTagSearchQuery(match[1]);
      setIsInlineTagOpen(true);
      
      const { view } = currentEditor;
      const { to } = view.state.selection;
      const coords = view.coordsAtPos(to);
      const domNode = inputContainerRef.current;
      
      if (domNode) {
        const containerRect = domNode.getBoundingClientRect();
        setCaretPosition({
          top: coords.bottom - containerRect.top + domNode.scrollTop,
          left: coords.left - containerRect.left + domNode.scrollLeft,
          height: coords.bottom - coords.top,
        });
      }
    } else {
      setIsInlineTagOpen(false);
    }
  };

  const handleInlineSelectTag = (tag: NoteCategory) => {
    if (editor) {
      const text = editor.getText();
      const match = text.match(/#(\w*)$/);
      if (match) {
        // We delete the `#searchQuery` and insert `#tag ` at the end.
        // Since Tiptap is just plain text, we can just replace the content
        const newText = text.substring(0, match.index) + `#${tag.name} `;
        editor.commands.setContent(newText);
        editor.commands.focus('end');
      }
    }
    setCategoryName(tag.name);
    setIsInlineTagOpen(false);
    setTagSearchQuery('');
  };

  const handleInlineCreateTag = (tagName: string) => {
    if (editor) {
      const text = editor.getText();
      const match = text.match(/#(\w*)$/);
      if (match) {
        const newText = text.substring(0, match.index) + `#${tagName} `;
        editor.commands.setContent(newText);
        editor.commands.focus('end');
      }
    }
    setCategoryName(tagName);
    setIsInlineTagOpen(false);
    setTagSearchQuery('');
  };

  const handleGenerateAI = async () => {
    // If there's no title but there's content, we can use content as prompt.
    // If there's a title, we use the title.
    const prompt = title.trim() || content.trim();
    if (!prompt) {
      toast.error('Please type a prompt in the title or content first!');
      return;
    }

    setIsGenerating(true);
    try {
      const categoryNames = categories.map(c => c.name);
      const res = await generateQuickNoteAI(prompt, categoryNames);
      
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
    let finalTitle = title;
    let finalCategory = categoryName;

    // Extract #tags from title if they exist and no category was explicitly set
    const tagMatches = title.match(/#\w+/g);
    if (tagMatches && tagMatches.length > 0) {
      if (!finalCategory) {
        finalCategory = tagMatches[0].replace('#', '');
      }
      finalTitle = title.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
    }

    if (!content.trim() && !finalTitle.trim()) return;
    setIsSaving(true);
    
    try {
      const result = await createQuickNote({
        title: finalTitle,
        content,
        categoryName: finalCategory,
        subjectId: selectedSubjectId || undefined,
        topicId: selectedTopicId || undefined
      });
      
      if (result.error) throw new Error(result.error);
      
      toast.success('Note saved!');
      setIsOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
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
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[101]"
          >
            {/* Header hint */}
            <div className="flex items-center gap-2 mb-3 px-1 text-white/50 text-[13px] font-medium">
              <Command className="w-4 h-4" />
              <span>Quick Add Note</span>
            </div>

            <motion.div
              animate={{ 
                borderColor: isGenerating ? "rgba(99, 102, 241, 0.4)" : "rgba(255,255,255,0.1)",
                boxShadow: isGenerating ? "0 0 25px -5px rgba(99, 102, 241, 0.25)" : "0 10px 30px -5px rgba(0,0,0,0.3)"
              }}
              transition={{ duration: 0.3 }}
              className="bg-[#2a2a2a] rounded-xl border p-3 flex flex-col gap-2 relative transition-colors duration-200"
            >
              
              {/* Title Row */}
              <div className="flex items-start gap-3 px-1 mt-1">
                <Circle className="w-5 h-5 text-white/20 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div ref={inputContainerRef} className="relative flex-1">
                  <style>{`
                    .task-title-input .is-editor-empty:first-child::before {
                      content: attr(data-placeholder);
                      float: left;
                      color: rgba(255, 255, 255, 0.4);
                      pointer-events: none;
                      height: 0;
                    }
                  `}</style>
                  <EditorContent editor={editor} />
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
                
                {/* AI Generate Button */}
                <button
                  onClick={handleGenerateAI}
                  disabled={isGenerating || isSaving || (!title.trim() && !content.trim())}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/50 text-[12px] font-medium transition-colors disabled:opacity-50 border border-white/5 mt-0.5"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate
                </button>
              </div>

              {/* Description Textarea */}
              <div className="pl-9 pr-2">
                <TextareaAutosize
                  placeholder="Add description..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  minRows={1}
                  maxRows={10}
                  disabled={isGenerating || isSaving}
                  className="w-full bg-transparent text-[13px] text-white/60 placeholder:text-white/30 focus:outline-none resize-none disabled:opacity-50 border-none m-0 p-0 leading-relaxed overflow-hidden"
                />
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between mt-1 px-1">
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

                {/* Action Buttons */}
                <div className="flex items-center gap-1 text-[12px]">
                  <button 
                    onClick={handleSave}
                    disabled={isGenerating || isSaving || (!content.trim() && !title.trim())}
                    className="px-2.5 py-1.5 text-white/50 hover:text-white/90 hover:bg-white/5 rounded-md transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    disabled={isGenerating || isSaving}
                    className="px-2.5 py-1.5 text-white/50 hover:text-white/90 hover:bg-white/5 rounded-md transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Loading Overlay when generating AI */}
              {isGenerating && (
                <div className="absolute inset-0 bg-[#2a2a2a]/80 backdrop-blur-sm flex items-center gap-3 px-12 z-10">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-indigo-400 font-medium">AI is generating your note...</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
