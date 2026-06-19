import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';

// Dummy data for topics search
const DUMMY_TOPICS = [
  { id: 't1', title: 'Generics in TS', subject: 'TS Prep' },
  { id: 't2', title: 'Client Component Boundaries', subject: 'Next.js Architecture' },
  { id: 't3', title: 'Data Fetching in Next 15', subject: 'Next.js Architecture' },
  { id: 't4', title: 'Caching Strategies', subject: 'Performance' },
  { id: 't5', title: 'Utility Types', subject: 'TS Prep' },
  { id: 't6', title: 'Advanced Generic Patterns', subject: 'OS Code Reading' },
];

export const getMentionSuggestions = {
  items: ({ query }: { query: string }) => {
    return DUMMY_TOPICS.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) || 
      item.subject.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  },

  render: () => {
    let component: ReactRenderer;
    let popup: any;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }

        return (component.ref as any)?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};

export const CustomMention = Mention.extend({
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) return {};
          return { 'data-id': attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        class: 'mention bg-accent/10 text-accent font-medium px-1.5 py-0.5 rounded-md hover:bg-accent/20 transition-colors cursor-pointer',
        'data-mention-id': node.attrs.id,
      },
      `@${node.attrs.label}`,
    ];
  },
});
