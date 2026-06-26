'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { SlashCommands } from '../extensions/SlashCommands';
import { CalloutExtension } from '../extensions/CalloutExtension';
import { SavedResourceExtension } from '../extensions/SavedResourceExtension';
import { FloatingToolbar } from '../extensions/FloatingToolbar';
import { CustomMention } from '../extensions/MentionExtension';
import { createMentionSuggestions } from '../extensions/MentionExtension';
import { searchTopicsInSubject, searchAllSubjects, addTopicMention } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DEFAULT_FONT_SIZE } from '../core/types';

interface InlineCursorProps {
  x: number;
  y: number;
  id?: string | null;
  initialContent?: string;
  onCommit: (html: string, dims?: { width: number; height: number }) => void;
  onDiscard: () => void;
  onChange?: (html: string) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  zoom?: number;
  fontSize?: number;
  color?: string;
  textColor?: string;
  maxWidth?: number;
  initialMinWidth?: number;
  onMoveCursor?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onResourceAdd?: (data: { text: string; type: 'url' | 'text' }) => void;
  topicId?: string;
  subjectId?: string;
}

interface ToolbarPosition {
  top: number;
  left: number;
}

export function InlineCursor({ x, y, id, initialContent, onCommit, onDiscard, onChange, onDimensionsChange, zoom = 1, maxWidth, initialMinWidth, color, textColor, fontSize, onMoveCursor, onResourceAdd, topicId, subjectId }: InlineCursorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isToolbarClickRef = useRef(false);
  const router = useRouter();

  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>({ top: 0, left: 0 });

  useEffect(() => {
    if (!wrapperRef.current || !onDimensionsChange) return;

    const resizeObserver = new ResizeObserver((entries) => {
      // Defer state updates to avoid React flushSync warnings during layout
      requestAnimationFrame(() => {
        for (const entry of entries) {
          onDimensionsChange(entry.contentRect.width, entry.contentRect.height);
        }
      });
    });

    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, [onDimensionsChange]);

  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [x, y]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }) as any,
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
        includeChildren: true,
        showOnlyCurrent: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-400 underline cursor-pointer hover:text-blue-300' },
      }),
      SlashCommands,
      CalloutExtension,
      CustomMention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: createMentionSuggestions(
          async (query: string) => {
            if (!topicId || !subjectId) return [];
            if (query.startsWith('/')) {
              const match = query.match(/^\/([^\/]+)\/(.*)$/);
              if (match) {
                const subjectName = match[1];
                const topicQuery = match[2];
                const subjects = await searchAllSubjects(subjectName);
                const exactSubject = subjects.find((s: any) => s.name === subjectName);
                if (exactSubject) {
                  const topics = await searchTopicsInSubject(exactSubject.id, topicQuery, topicId);
                  return topics.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    subject: exactSubject.name,
                    isSubject: false
                  }));
                }
                return [];
              } else {
                const sq = query.slice(1).trim();
                const subjects = await searchAllSubjects(sq);
                return subjects.map((s: any) => ({
                  id: s.id,
                  title: s.name,
                  subject: 'Cross-Subject',
                  isSubject: true
                }));
              }
            } else {
              const topics = await searchTopicsInSubject(subjectId, query, topicId);
              return topics.map((t: any) => ({
                id: t.id,
                title: t.title,
                subject: 'Current Subject',
                isSubject: false
              }));
            }
          },
          async (targetId: string) => {
            if (topicId && targetId) {
              await addTopicMention(topicId, targetId);
              router.refresh();
            }
          }
        ),
      }),
      SavedResourceExtension.configure({
        onResourceAdd: (data) => {
          if (onResourceAdd) {
            onResourceAdd(data);
          }
        }
      }),
    ],
    content: initialContent || '',
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'outline-none max-w-none',
        style: `white-space: pre-wrap; word-break: break-word; max-width: 100%; margin: 0; padding-left: 4px; padding-right: 4px; padding-top: 2px; padding-bottom: 2px;`,
      },
      handleKeyDown: (view, event) => {
        if (wrapperRef.current && event.key.length === 1) {
          try {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const caretRect = sel.getRangeAt(0).getBoundingClientRect();
              const wrapperRect = wrapperRef.current.getBoundingClientRect();
              if (wrapperRect.right - caretRect.right < 50) {
                wrapperRef.current.style.width = `${wrapperRef.current.offsetWidth + 50}px`;
              }
            }
          } catch (_) {}
        }

        if (!onMoveCursor) return false;
        
        const text = view.state.doc.textContent;
        if (text.trim().length === 0) {
          if (event.key === 'ArrowUp') {
            onMoveCursor('up');
            return true;
          }
          if (event.key === 'ArrowDown') {
            onMoveCursor('down');
            return true;
          }
          if (event.key === 'ArrowLeft') {
            onMoveCursor('left');
            return true;
          }
          if (event.key === 'ArrowRight') {
            onMoveCursor('right');
            return true;
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      // Delay the onChange callback to the next tick to prevent React flushSync errors
      // caused by updating parent state during Tiptap's synchronous node view rendering.
      setTimeout(() => {
        onChangeRef.current?.(editor.getHTML());
      }, 0);
    },
    onBlur: () => {
      let capturedWidth = wrapperRef.current?.offsetWidth || 0;
      const capturedHeight = wrapperRef.current?.offsetHeight || 0;

      if (editor && !editor.isDestroyed) {
        try {
          let maxChildWidth = 0;
          const children = Array.from(editor.view.dom.children);
          
          children.forEach(child => {
            const el = child as HTMLElement;
            const originalDisplay = el.style.display;
            // inline-block forces the element to shrink-wrap its text content
            el.style.display = 'inline-block';
            maxChildWidth = Math.max(maxChildWidth, el.getBoundingClientRect().width);
            el.style.display = originalDisplay;
          });

          // Add a small 8px buffer for the padding (4px left + 4px right)
          if (maxChildWidth > 0) {
            capturedWidth = Math.ceil(maxChildWidth) + 8;
          }
        } catch (_) {}
      }

      setTimeout(() => {
        if (!editor || editor.isDestroyed) return;
        if (isToolbarClickRef.current) {
          isToolbarClickRef.current = false;
          return;
        }
        
        // Don't commit if focus just moved to a child element (e.g. an inline node input box)
        if (wrapperRef.current && wrapperRef.current.contains(document.activeElement)) {
          return;
        }

        const html = editor.getHTML();
        const text = editor.getText();
        if (text.trim().length === 0) {
          onDiscard();
        } else {
          onCommit(html, {
            width: capturedWidth,
            height: capturedHeight
          });
        }
      }, 100);
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      requestAnimationFrame(() => {
        editor.commands.focus('end');
      });
    }
  }, [editor]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDiscard();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDiscard]);

  useEffect(() => {
    if (!editor) return;

    const updateToolbar = () => {
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;

      if (hasSelection) {
        const { view } = editor;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);

        const toolbarWidth = 400;
        const left = Math.max(10, (start.left + end.left) / 2 - toolbarWidth / 2);
        const top = Math.max(10, start.top - 50);

        setToolbarPosition({ top, left });
        setShowFloatingToolbar(true);
      } else {
        setShowFloatingToolbar(false);
      }
    };

    const handleBlur = () => {
      setTimeout(() => {
        setShowFloatingToolbar(false);
      }, 200);
    };

    editor.on('selectionUpdate', updateToolbar);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', updateToolbar);
      editor.off('blur', handleBlur);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      ref={wrapperRef}
      id={id || undefined}
      className="absolute"
      style={{
        left: x,
        top: y,
        width: initialMinWidth ? `${initialMinWidth}px` : 'max-content',
        minWidth: initialMinWidth ? `${initialMinWidth}px` : '2px',
        maxWidth: maxWidth ? `${maxWidth}px` : '80%',
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        zIndex: 100,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn("inline-cursor-editor notion-editor rounded-lg transition-colors duration-200", color)}
        style={{
          color: textColor || undefined,
        }}
      >
        <EditorContent
          editor={editor}
          style={{
            minHeight: '1.6em',
            fontSize: `${fontSize || DEFAULT_FONT_SIZE}px`,
          }}
        />
      </div>

      {editor && (
        <div
          onMouseDown={() => {
            isToolbarClickRef.current = true;
          }}
        >
          <FloatingToolbar
            editor={editor}
            show={showFloatingToolbar}
            position={toolbarPosition}
          />
        </div>
      )}
    </div>
  );
}
