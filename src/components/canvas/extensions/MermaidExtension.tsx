import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidNodeView } from './MermaidNodeView';

export const MermaidExtension = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true, // It's an atomic block, meaning it can't contain other editable Tiptap nodes inside it

  addAttributes() {
    return {
      code: {
        default: 'graph TD;\n  A-->B;',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'pre',
        getAttrs: (element) => {
          const codeElement = element.querySelector('code');
          if (codeElement && codeElement.className.includes('language-mermaid')) {
            return {
              code: codeElement.textContent,
            };
          }
          return false; // Not a mermaid block
        },
      },
      {
        tag: 'div[data-type="mermaid"]',
        getAttrs: (element) => ({
          code: element.getAttribute('data-code'),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});
