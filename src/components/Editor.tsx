"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export default function Editor({ initialContent }: { initialContent?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: initialContent || '<p>Start typing your notes here...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px]',
      },
    },
  })

  return (
    <div className="w-full bg-background border border-divider rounded-md overflow-hidden">
      {/* Editor Toolbar (Basic) */}
      <div className="bg-sidebar border-b border-divider p-2 flex gap-2">
        <button 
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-sm ${editor?.isActive('bold') ? 'bg-accent text-white' : 'hover:bg-hover'}`}
        >
          Bold
        </button>
        <button 
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-sm ${editor?.isActive('italic') ? 'bg-accent text-white' : 'hover:bg-hover'}`}
        >
          Italic
        </button>
        <button 
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-sm ${editor?.isActive('codeBlock') ? 'bg-accent text-white' : 'hover:bg-hover'}`}
        >
          Code Block
        </button>
      </div>
      
      {/* Editor Content Area */}
      <div className="p-4 text-foreground text-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
