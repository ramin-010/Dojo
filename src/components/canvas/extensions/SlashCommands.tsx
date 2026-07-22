'use client';

import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { Instance } from 'tippy.js';
import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Code, Minus, CheckSquare, Type,
  Info, AlertTriangle, Lightbulb, AlertOctagon, Globe, Table as TableIcon, GitBranch, Brain
} from 'lucide-react';

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

export const getSuggestionItems = (): CommandItem[] => [
  {
    title: 'Text',
    description: 'Plain text',
    icon: <Type className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'To-do List',
    description: 'Track tasks with a todo list',
    icon: <CheckSquare className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Simple bullet list',
    icon: <List className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: <ListOrdered className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    icon: <Quote className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Code snippet',
    icon: <Code className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    description: 'Visually divide content',
    icon: <Minus className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Table',
    description: 'Insert a 3x3 table',
    icon: <TableIcon className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Context Pill',
    description: 'Embed hidden raw context data',
    icon: <Brain className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'contextPill',
        attrs: { label: 'Context Pill', content: '' }
      }).run();
    },
  },
  {
    title: 'Diagram',
    description: 'Insert a Mermaid diagram',
    icon: <GitBranch className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'mermaid',
        attrs: { code: 'graph TD;\n  A[Start] --> B{Is it ready?};\n  B -- Yes --> C[Deploy];\n  B -- No --> D[Refactor];' }
      }).run();
    },
  },
  // --- Callout Commands ---
  {
    title: 'Info',
    description: 'Informational callout',
    icon: <Info className="w-4 h-4 text-blue-400" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('info').run();
    },
  },
  {
    title: 'Warning',
    description: 'Warning callout',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('warning').run();
    },
  },
  {
    title: 'Tip',
    description: 'Helpful tip callout',
    icon: <Lightbulb className="w-4 h-4 text-emerald-400" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('tip').run();
    },
  },
  {
    title: 'Danger',
    description: 'Critical danger callout',
    icon: <AlertOctagon className="w-4 h-4 text-red-400" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('danger').run();
    },
  },
];

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    if (containerRef.current) {
      const selectedItem = containerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const selectItem = useCallback((index: number) => {
    const item = items[index];
    if (item) {
      command(item);
    }
  }, [items, command]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }), [items.length, selectItem, selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="bg-[#202020] border border-[#262626] rounded-lg shadow-xl overflow-hidden p-1 min-w-[200px] z-50">
        <div className="px-3 py-2 text-sm text-white/50">No results</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-[#202020] border border-[#262626] rounded-lg shadow-xl overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-thumb-[#3f3f46] scrollbar-track-transparent w-64 p-1 z-50">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            selectItem(index);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors ${index === selectedIndex ? 'bg-[#3b82f6] text-white' : 'text-[#e5e5e5] hover:bg-[#2d2d2d]'}`}
        >
          <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded bg-transparent">{item.icon}</div>
          <div className="flex flex-col">
            <span className="font-medium leading-none">{item.title}</span>
            <span className="text-xs text-white/50 mt-1">{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
});

CommandList.displayName = 'CommandList';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
          props.command({ editor, range });
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return getSuggestionItems().filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: Instance[] | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props: SuggestionProps) => {
              component?.updateProps(props);

              if (!props.clientRect) return;

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },
            onKeyDown: (props: { event: KeyboardEvent }) => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return (component?.ref as CommandListRef)?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
