'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageGalleryNodeView } from '../blocks/ImageGalleryNode';

export interface ImageGalleryOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageGallery: {
      /**
       * Insert a new image gallery node with the given image URLs.
       */
      insertImageGallery: (images: { src: string; alt?: string; uploading?: boolean }[]) => ReturnType;
      /**
       * Append an image to the nearest image gallery node, or create one.
       */
      appendToImageGallery: (image: { src: string; alt?: string; uploading?: boolean }) => ReturnType;
    };
  }
}

export const ImageGalleryExtension = Node.create<ImageGalleryOptions>({
  name: 'imageGallery',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          try {
            const data = element.getAttribute('data-images');
            return data ? JSON.parse(data) : [];
          } catch (_e) {
            return [];
          }
        },
        renderHTML: (attributes: Record<string, any>) => {
          return {
            'data-images': JSON.stringify(attributes.images),
          };
        },
      },
      containerHeight: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const height = element.getAttribute('data-container-height');
          return height ? parseInt(height, 10) : null;
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.containerHeight) return {};
          return {
            'data-container-height': attributes.containerHeight,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-gallery"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'image-gallery' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView);
  },

  addCommands() {
    return {
      insertImageGallery:
        (images) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { images },
          });
        },
      appendToImageGallery:
        (image) =>
        ({ state, chain }) => {
          // Walk backwards from current position to find an existing imageGallery node
          const { doc, selection } = state;
          const pos = selection.from;
          let found = false;

          // Check the node right before the cursor
          doc.nodesBetween(Math.max(0, pos - 2), pos, (node, nodePos) => {
            if (node.type.name === this.name && !found) {
              found = true;
              const existingImages = node.attrs.images || [];
              const newImages = [...existingImages, image];
              chain()
                .command(({ tr }) => {
                  tr.setNodeMarkup(nodePos, undefined, {
                    ...node.attrs,
                    images: newImages,
                  });
                  return true;
                })
                .run();
            }
          });

          if (!found) {
            // No gallery found nearby, insert a new one
            return chain()
              .insertContent({
                type: this.name,
                attrs: { images: [image] },
              })
              .run();
          }

          return true;
        },
    };
  },
});
