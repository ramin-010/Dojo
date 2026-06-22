'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
const STICKY_NOTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>`;

const GLOBE_SVG_RENDER_HTML = ['svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
  ['path', { d: 'M2 12h20' }]
];

const STICKY_NOTE_SVG_RENDER_HTML = ['svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  ['path', { d: 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z' }],
  ['path', { d: 'M15 3v4a2 2 0 0 0 2 2h4' }]
];

function getDisplayDomain(text: string, isUrl: boolean) {
  if (isUrl) {
    try {
      return new URL(text).hostname;
    } catch (e) {
      return text;
    }
  }
  return text.length > 30 ? text.substring(0, 30) + '...' : text;
}

export interface SavedResourceOptions {
  onResourceAdd: (data: { text: string; type: 'url' | 'text' }) => void;
}

export const SavedResourceExtension = Node.create<SavedResourceOptions>({
  name: 'savedResource',
  group: 'inline',
  inline: true,
  // We need this to not be empty by default if we don't have text, 
  // but it's an inline node with no content, so we just use atom
  atom: true,

  addOptions() {
    return {
      onResourceAdd: () => {},
    };
  },

  addAttributes() {
    return {
      isSaved: { default: false },
      text: { default: '' }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="saved-resource"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const isSaved = HTMLAttributes.isSaved;
    const text = HTMLAttributes.text || '';

    if (!isSaved) {
      return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'saved-resource' })];
    }

    const isUrl = /^https?:\/\/[^\s]+$/.test(text);
    const displayDomain = getDisplayDomain(text, isUrl);
    const icon = isUrl ? GLOBE_SVG_RENDER_HTML : STICKY_NOTE_SVG_RENDER_HTML;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'saved-resource',
        class: 'inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2.5 py-1 cursor-pointer select-none mx-1 shadow-sm hover:shadow hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all duration-200 align-middle'
      }),
      ['span', { class: 'flex items-center gap-1.5 pointer-events-none' },
        icon,
        ['span', { class: 'text-[13px] font-medium leading-none mt-[1px]' }, displayDomain]
      ]
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const isSaved = node.attrs.isSaved;
      const text = node.attrs.text || '';

      const dom = document.createElement('span');

      let inputElement: HTMLInputElement | null = null;

      if (isSaved) {
        const isUrl = /^https?:\/\/[^\s]+$/.test(text);
        const displayDomain = getDisplayDomain(text, isUrl);

        dom.className = "inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2.5 py-1 cursor-pointer select-none mx-1 shadow-sm hover:shadow hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all duration-200 align-middle";
        dom.title = isUrl ? 'Double-click to open link' : 'Saved note';
        
        // Inner container
        const inner = document.createElement('span');
        inner.contentEditable = 'false';
        inner.className = "flex items-center gap-1.5 pointer-events-none";

        // Simple SVG icon for globe or sticky note
        const iconSvg = document.createElement('span');
        iconSvg.innerHTML = isUrl ? GLOBE_SVG : STICKY_NOTE_SVG;
        
        const label = document.createElement('span');
        label.className = "text-[13px] font-medium leading-none mt-[1px]";
        label.innerText = displayDomain;

        inner.appendChild(iconSvg);
        inner.appendChild(label);
        dom.appendChild(inner);

        dom.addEventListener('dblclick', () => {
          if (isUrl) window.open(text, '_blank');
        });

      } else {
        dom.className = "inline-flex items-center gap-2 px-2 py-0.5 mx-1 bg-background border shadow-[0_2px_8px_rgba(0,122,204,0.15)] rounded ring-1 ring-[#007acc]/30 transition-all align-middle";
        
        const trigger = document.createElement('span');
        trigger.contentEditable = 'false';
        trigger.className = "flex items-center justify-center bg-[#007acc]/10 text-[#007acc] rounded px-1 text-xs font-bold pointer-events-none select-none";
        trigger.innerText = '=>';

        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = 'Type URL or note...';
        inputElement.className = "outline-none bg-transparent text-[14px] text-[#007acc] font-medium min-w-[150px] flex-1 py-0.5";
        
        dom.appendChild(trigger);
        dom.appendChild(inputElement);

        // Safely focus
        setTimeout(() => inputElement?.focus(), 50);

        inputElement.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = inputElement!.value.trim();
            if (val) {
              const pos = getPos();
              if (typeof pos === 'number') {
                // Update node explicitly using its exact position
                const tr = editor.state.tr;
                tr.setNodeMarkup(pos, undefined, { isSaved: true, text: val });
                editor.view.dispatch(tr);
                
                const isUrl = /^https?:\/\/[^\s]+$/.test(val);
                const ext = editor.extensionManager.extensions.find((ex: any) => ex.name === 'savedResource');
                if (ext && ext.options.onResourceAdd) {
                  ext.options.onResourceAdd({ text: val, type: isUrl ? 'url' : 'text' });
                }

                setTimeout(() => {
                  editor.chain().focus().setTextSelection(pos + 1).insertContent(' ').run();
                }, 0);
              }
            } else {
              const pos = getPos();
              if (typeof pos === 'number') {
                editor.commands.deleteRange({ from: pos, to: pos + 1 });
                editor.commands.focus();
              }
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.deleteRange({ from: pos, to: pos + 1 });
              editor.commands.focus();
            }
          }
        });
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'savedResource') return false;
          // ReactNodeView handles re-renders automatically.
          // For Vanilla JS, if it changes to isSaved, we just tell Tiptap to recreate the nodeView
          if (updatedNode.attrs.isSaved !== node.attrs.isSaved) return false;
          return true;
        },
        ignoreMutation: (mutation) => {
          if (!isSaved && inputElement && mutation.target === inputElement) return true;
          return false;
        },
        stopEvent: (e) => {
          // If the event is happening inside our input, completely block Prosemirror from seeing it!
          if (!isSaved && e.target === inputElement) {
            return true;
          }
          return false;
        }
      };
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('savedResourceInput'),
        props: {
          handleTextInput: (view, from, to, text) => {
            if (text === '>') {
              const prevChar = view.state.doc.textBetween(from - 1, from);
              if (prevChar === '=') {
                // Delay the node insertion to avoid React flushSync conflicts
                // caused by Tiptap rendering ReactNodeViews during an active React render cycle.
                Promise.resolve().then(() => {
                  if (view.isDestroyed) return;
                  const { state, dispatch } = view;
                  const currentPos = state.selection.from;
                  const matchText = state.doc.textBetween(currentPos - 2, currentPos);
                  if (matchText === '=>') {
                    dispatch(state.tr.replaceWith(currentPos - 2, currentPos, this.type.create({ isSaved: false, text: '' })));
                  }
                });
                // Let Prosemirror insert the '>' first so our async check correctly finds '=>'
                return false;
              }
            }
            return false;
          }
        }
      })
    ];
  },
});
