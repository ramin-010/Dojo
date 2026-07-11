'use client';

import React from 'react';
import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { SplitViewData } from '../types';
import { ReadOnlyTopicCanvas } from './ReadOnlyTopicCanvas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResourcePreviewModal } from './resources/ResourcePreviewModal';
import { BlockEditor } from '@/components/canvas/blocks/BlockEditor';

interface SplitViewerProps {
  data: SplitViewData;
  onClose: () => void;
}

const DUMMY_MARKDOWN = `
# Sample Markdown Document

This is a beautiful "Pretty View" rendered natively using \`react-markdown\` and Tailwind Typography.

## Features Supported:
- **Bold text** and *italic text*
- [Clickable Links](#)
- Tables, lists, and more!

| Syntax      | Description |
| ----------- | ----------- |
| Header      | Title       |
| Paragraph   | Text        |

\`\`\`javascript
function helloWorld() {
  console.log("Hello, world!");
}
\`\`\`

> "Markdown is an elegant way to format text!"
`;

function ResourcePreview({ data }: { data: any }) {
  const [markdownContent, setMarkdownContent] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewResource, setPreviewResource] = React.useState<any>(null);

  React.useEffect(() => {
    if (data.title?.toLowerCase().endsWith('.md')) {
      if (data.url === '#') {
        setMarkdownContent(DUMMY_MARKDOWN);
      } else {
        setIsLoading(true);
        fetch(data.url)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch markdown file');
            return res.text();
          })
          .then((text) => setMarkdownContent(text))
          .catch((err) => setError(err.message))
          .finally(() => setIsLoading(false));
      }
    }
  }, [data]);

  if (data.category === 'image_list' && Array.isArray(data.urls)) {
    return (
      <div className="w-full h-full bg-sidebar overflow-y-auto p-8 custom-scrollbar relative">
        <div className="flex flex-col gap-8 items-center max-w-4xl mx-auto">
          {data.urls.map((url: string, index: number) => (
            <img 
              key={index}
              src={url} 
              alt={data.title ? `${data.title} ${index + 1}` : `Resource ${index + 1}`} 
              className="w-full h-auto object-contain drop-shadow-xl rounded-md ring-1 ring-white/10 select-none animate-in zoom-in-95 duration-300 cursor-pointer hover:ring-white/30 transition-all"
              onClick={() => setPreviewResource({ id: `img-${index}`, category: 'image', url, title: data.title ? `${data.title} ${index + 1}` : `Resource ${index + 1}` })}
            />
          ))}
        </div>
        {previewResource && (
          <ResourcePreviewModal resource={previewResource} onClose={() => setPreviewResource(null)} />
        )}
      </div>
    );
  }

  if (data.category === 'image' || data.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null || data.url?.startsWith('data:image') || data.url?.startsWith('blob:')) {
    const src = data.url === '#' && data.thumbnailUrl ? data.thumbnailUrl : data.url;
    return (
      <div className="w-full h-full flex items-center justify-center p-8 bg-sidebar relative">
        <img 
          src={src} 
          alt={data.title || 'Resource'} 
          className="max-w-full max-h-full object-contain drop-shadow-xl rounded-md ring-1 ring-white/10 select-none animate-in zoom-in-95 duration-300 cursor-pointer hover:ring-white/30 transition-all"
          onClick={() => setPreviewResource({ id: data.id || 'img', category: 'image', url: src, title: data.title || 'Resource' })}
        />
        {previewResource && (
          <ResourcePreviewModal resource={previewResource} onClose={() => setPreviewResource(null)} />
        )}
      </div>
    );
  }

  if (data.url === '#' && !data.title?.toLowerCase().endsWith('.md')) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 bg-sidebar">
        <div className="w-full max-w-xl p-12 bg-zinc-950/80 backdrop-blur-md rounded-2xl ring-1 ring-white/10 flex flex-col items-center justify-center text-zinc-400 shadow-2xl">
          <FileText className="w-16 h-16 mb-6 opacity-20" />
          <p className="font-semibold text-white text-lg">Preview not available</p>
          <p className="text-sm mt-2 opacity-70">Real URLs will load seamlessly in the document viewer.</p>
        </div>
      </div>
    );
  }

  if (data.title?.toLowerCase().endsWith('.md') || data.content) {
    return (
      <div className="w-full h-full bg-background overflow-y-auto p-6 sm:p-6 sm:pt-12 custom-scrollbar border-t border-divider">
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-32 text-muted-foreground animate-pulse">Loading document...</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 text-red-400">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="prose prose-zinc dark:prose-invert max-w-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-a:text-blue-500 hover:prose-a:text-blue-400 prose-headings:font-semibold">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.content || markdownContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Use native browser PDF viewer for PDFs, fallback to Google Docs Viewer for DOCX/XLSX/etc
  const isPdf = data.title?.toLowerCase().endsWith('.pdf') || data.url?.toLowerCase().includes('.pdf');
  const viewerUrl = isPdf 
    ? `${data.url}#toolbar=0` 
    : `https://docs.google.com/viewer?url=${encodeURIComponent(data.url)}&embedded=true`;
    
  return (
    <div className="w-full h-full bg-white relative">
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-500">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading document viewer...</span>
        </div>
      </div>
      <iframe 
        src={viewerUrl} 
        className="w-full h-full relative z-10 border-0" 
        title={data.title}
      />
    </div>
  );
}

export function SplitViewer({ data, onClose }: SplitViewerProps) {
  return (
    <div className="w-full h-full flex flex-col bg-sidebar relative border-l border-divider animate-in slide-in-from-right-8 fade-in duration-300 shadow-xl group">
      {/* Floating Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur-md  border-border shadow-sm hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-all z-50 opacity-50 hover:opacity-100"
        title="Close Split View"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Content Area */}
      <div className="flex-1 w-full h-full overflow-hidden relative">
        {data.type === 'topic_link' && (
          <ReadOnlyTopicCanvas topicId={data.id} />
        )}

        {data.type === 'note' && (
          <div className="p-8 max-w-2xl mx-auto w-full h-full overflow-y-auto prose-editor-read-only">
            <h2 className="text-2xl font-bold mb-4">{data.data.title || 'Untitled Note'}</h2>
            <BlockEditor 
              content={data.data.content} 
              onChange={() => {}} 
              readOnly={true} 
            />
          </div>
        )}

        {data.type === 'resource' && (
          <ResourcePreview data={data.data} />
        )}
      </div>
    </div>
  );
}
