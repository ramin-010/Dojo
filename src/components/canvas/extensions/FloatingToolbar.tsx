'use client';

import { useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, List, ListOrdered, Quote, Code, 
  Heading1, Heading2, Link as LinkIcon, Palette, Highlighter,
  Underline as UnderlineIcon, Type
} from 'lucide-react';

interface ToolbarPosition {
  top: number;
  left: number;
}

export const HIGHLIGHT_COLORS = [
  { color: 'rgba(254, 240, 138, 0.25)', name: 'Yellow' },
  { color: 'rgba(187, 247, 208, 0.25)', name: 'Green' },
  { color: 'rgba(147, 197, 253, 0.25)', name: 'Blue' },
  { color: 'rgba(252, 165, 165, 0.25)', name: 'Red' },
  { color: 'rgba(216, 180, 254, 0.25)', name: 'Purple' },
  { color: 'rgba(253, 186, 116, 0.25)', name: 'Orange' },
  { color: 'rgba(251, 207, 232, 0.25)', name: 'Pink' },
  { color: 'rgba(94, 234, 212, 0.35)', name: 'Teal' },
  { color: 'rgba(148, 163, 184, 0.4)', name: 'Gray' },
];

export const TEXT_COLORS = [
  { color: '', label: 'Default', preview: 'var(--foreground)' },
  { color: '#f8fafc', label: 'White', preview: '#f8fafc' },
  { color: '#94a3b8', label: 'Slate', preview: '#94a3b8' },
  { color: '#60a5fa', label: 'Blue', preview: '#60a5fa' },
  { color: '#4ade80', label: 'Green', preview: '#4ade80' },
  { color: '#fb923c', label: 'Orange', preview: '#fb923c' },
  { color: '#f472b6', label: 'Pink', preview: '#f472b6' },
  { color: '#a78bfa', label: 'Purple', preview: '#a78bfa' },
  { color: '#fbbf24', label: 'Amber', preview: '#fbbf24' },
];

interface FloatingToolbarProps {
  editor: Editor;
  show: boolean;
  position: ToolbarPosition;
}

export function FloatingToolbar({ editor, show, position }: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (!show) return null;

  return (
    <div 
      ref={toolbarRef}
      className="fixed z-[9999] flex items-center gap-0.5 p-1.5 rounded-lg bg-popover border border-border shadow-xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
      onMouseDown={preventBlur}
    >
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('bold') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('italic') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('underline') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <UnderlineIcon className="h-4 w-4" />
      </button>
      
      <div className="relative">
        <button 
          type="button" 
          onClick={() => {
            setShowTextColorPicker(!showTextColorPicker);
            setShowHighlightPicker(false);
          }} 
          className={`p-1.5 rounded hover:bg-accent ${showTextColorPicker ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}
        >
          <Palette className="h-4 w-4" />
        </button>
        {showTextColorPicker && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-popover border border-border rounded-xl shadow-2xl z-50 min-w-[200px]">
            <p className="text-[10px] text-foreground/50 mb-2 text-center uppercase tracking-wider font-semibold">Text Color</p>
            <div className="grid grid-cols-4 gap-2">
              {TEXT_COLORS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.color) {
                      editor.chain().focus().setColor(item.color).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                    setShowTextColorPicker(false);
                  }}
                  className="w-10 h-10 rounded-lg border-2 border-border hover:scale-105 hover:border-white/50 transition-all flex items-center justify-center font-serif text-lg font-bold"
                  style={{ backgroundColor: item.color || item.preview, color: item.color === '#f8fafc' || item.color === undefined ? '#000' : '#fff' }}
                  title={item.label}
                >
                  A
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setShowTextColorPicker(false);
              }}
              className="w-full mt-2 px-3 py-1.5 text-xs text-foreground/50 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              Default text color
            </button>
          </div>
        )}
      </div>
      
      <div className="relative">
        <button 
          type="button" 
          onClick={() => {
            setShowHighlightPicker(!showHighlightPicker);
            setShowTextColorPicker(false);
          }} 
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('highlight') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}
        >
          <Highlighter className="h-4 w-4" />
        </button>
        {showHighlightPicker && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-popover border border-border rounded-xl shadow-2xl z-50 min-w-[200px]">
            <p className="text-[10px] text-foreground/50 mb-2 text-center uppercase tracking-wider font-semibold">Highlight Color</p>
            <div className="grid grid-cols-4 gap-2">
              {HIGHLIGHT_COLORS.map((item) => (
                <button
                  key={item.color}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: item.color }).run();
                    setShowHighlightPicker(false);
                  }}
                  className="w-10 h-10 rounded-lg border-2 border-border hover:scale-105 hover:border-white/50 transition-all"
                  style={{ backgroundColor: item.color }}
                  title={item.name}
                />
              ))}
            </div>
            <button
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setShowHighlightPicker(false);
              }}
              className="w-full mt-2 px-3 py-1.5 text-xs text-foreground/50 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              Remove highlight
            </button>
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('paragraph') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`} title="Normal text">
        <Type className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('heading', { level: 1 }) ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <Heading1 className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('heading', { level: 2 }) ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <Heading2 className="h-4 w-4" />
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('bulletList') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <List className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('orderedList') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <ListOrdered className="h-4 w-4" />
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('blockquote') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <Quote className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('codeBlock') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <Code className="h-4 w-4" />
      </button>
      <button type="button" onClick={addLink} className={`p-1.5 rounded hover:bg-accent ${editor.isActive('link') ? 'text-accent-foreground bg-accent' : 'text-foreground/70'}`}>
        <LinkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
