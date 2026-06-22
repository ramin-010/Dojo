import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';

export const createMentionSuggestions = (
  fetchMentions: (query: string) => Promise<any[]>,
  onMentionAdd: (id: string) => void
) => {
  const queryCache = new Map<string, any[]>();
  let debounceTimeout: NodeJS.Timeout;
  let activePromiseResolve: ((value: any[]) => void) | null = null;
  let lastResults: any[] = [];

  return {
    allowSpaces: true,
    items: ({ query }: { query: string }) => {
      return new Promise<any[]>((resolve) => {
        if (queryCache.has(query)) {
          lastResults = queryCache.get(query)!;
          resolve(lastResults);
          return;
        }

        if (activePromiseResolve) {
          activePromiseResolve(lastResults);
        }
        activePromiseResolve = resolve;

        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
          const results = await fetchMentions(query);
          queryCache.set(query, results);
          lastResults = results;
          if (activePromiseResolve === resolve) {
            resolve(results);
            activePromiseResolve = null;
          }
        }, 150);
      });
    },

  render: () => {
    let component: ReactRenderer;
    let popup: any;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props: {
            ...props,
            onMentionAdd,
          },
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
        class: 'mention inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-2.5 py-1 cursor-pointer select-none mx-1 shadow-sm hover:bg-blue-500/20 transition-all duration-200 align-middle relative -top-[1px] text-[13px] font-medium leading-none',
        'data-mention-id': node.attrs.id,
      },
      `@${node.attrs.label}`,
    ];
  },
});
