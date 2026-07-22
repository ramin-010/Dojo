'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ContextPillNode } from '../blocks/ContextPillNode';

export interface ContextPillOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    contextPill: {
      insertContextPill: (options?: { label?: string; content?: string }) => ReturnType;
    };
  }
}

export const ContextPillExtension = Node.create<ContextPillOptions>({
  name: 'contextPill',

  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      label: {
        default: 'Context Pill',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-label') || 'Context Pill',
        renderHTML: (attributes: Record<string, any>) => {
          return {
            'data-label': attributes.label,
          };
        },
      },
      content: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-content') || '',
        renderHTML: (attributes: Record<string, any>) => {
          return {
            'data-content': attributes.content,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="context-pill"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'context-pill',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContextPillNode);
  },

  addCommands() {
    return {
      insertContextPill:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: options.label || 'Context Pill',
              content: options.content || '',
            },
          });
        },
    };
  },
});
