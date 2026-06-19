'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, Lightbulb, AlertOctagon } from 'lucide-react';

const CALLOUT_STYLES = {
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-l-blue-500',
    iconColor: 'text-blue-400',
    label: 'Info',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
    iconColor: 'text-amber-400',
    label: 'Warning',
  },
  tip: {
    icon: Lightbulb,
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
    iconColor: 'text-emerald-400',
    label: 'Tip',
  },
  danger: {
    icon: AlertOctagon,
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
    iconColor: 'text-red-400',
    label: 'Danger',
  },
};

type CalloutType = keyof typeof CALLOUT_STYLES;

function CalloutNodeView({ node }: { node: any }) {
  const calloutType: CalloutType = node.attrs.type || 'info';
  const style = CALLOUT_STYLES[calloutType];
  const Icon = style.icon;

  return (
    <NodeViewWrapper>
      <div className={cn(
        "rounded-lg border-l-4 px-4 py-3 my-2 flex gap-3 items-start",
        style.bg, style.border
      )}>
        <div className={cn("mt-0.5 flex-shrink-0", style.iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1", style.iconColor)}>
            {style.label}
          </div>
          <NodeViewContent className="prose prose-sm dark:prose-invert max-w-none leading-relaxed [&>p]:my-0.5 text-foreground/80" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || 'info',
        renderHTML: attributes => ({
          'data-callout-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-callout-type]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  addCommands() {
    return {
      setCallout: (type: CalloutType) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: { type },
          content: [{ type: 'paragraph' }],
        });
      },
    } as any;
  },
});

export const CALLOUT_READ_STYLES = `
  [data-callout-type] { border-left: 4px solid; border-radius: 0.5rem; padding: 0.75rem 1rem; margin: 0.5rem 0; display: flex; gap: 0.75rem; align-items: flex-start; }
  [data-callout-type="info"] { border-color: rgb(59 130 246); background: rgb(59 130 246 / 0.1); }
  [data-callout-type="warning"] { border-color: rgb(245 158 11); background: rgb(245 158 11 / 0.1); }
  [data-callout-type="tip"] { border-color: rgb(16 185 129); background: rgb(16 185 129 / 0.1); }
  [data-callout-type="danger"] { border-color: rgb(239 68 68); background: rgb(239 68 68 / 0.1); }
`;
