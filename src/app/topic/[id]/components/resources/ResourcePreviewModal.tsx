import React, { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResourceRowProps } from './ResourceRow';

interface ResourcePreviewModalProps {
  resource: ResourceRowProps | null;
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

export function ResourcePreviewModal({ resource, onClose }: ResourcePreviewModalProps) {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resource) return;

    if (resource.title.toLowerCase().endsWith('.md')) {
      if (resource.url === '#') {
        setMarkdownContent(DUMMY_MARKDOWN);
      } else {
        setIsLoading(true);
        fetch(resource.url)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch markdown file');
            return res.text();
          })
          .then((text) => setMarkdownContent(text))
          .catch((err) => setError(err.message))
          .finally(() => setIsLoading(false));
      }
    }
  }, [resource]);

  if (!resource) return null;

  const renderContent = () => {
    if (resource.category === 'image') {
      return (
        <img 
          src={resource.url === '#' && resource.thumbnailUrl ? resource.thumbnailUrl : resource.url} 
          alt={resource.title} 
          className="max-w-full max-h-full object-contain drop-shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-md ring-1 ring-white/10 select-none animate-in zoom-in-95 duration-300"
        />
      );
    }

    if (resource.url === '#' && !resource.title.toLowerCase().endsWith('.md')) {
      return (
        <div className="w-full max-w-3xl h-[60vh] bg-zinc-950/80 backdrop-blur-md rounded-2xl ring-1 ring-white/10 flex flex-col items-center justify-center text-zinc-400 shadow-2xl">
          <FileText className="w-16 h-16 mb-6 opacity-20" />
          <p className="font-semibold text-white text-lg">Preview not available</p>
          <p className="text-sm mt-2 opacity-70">Real URLs will load seamlessly in the document viewer.</p>
        </div>
      );
    }

    if (resource.title.toLowerCase().endsWith('.md')) {
      return (
        <div className="w-full max-w-4xl h-full bg-background rounded-2xl ring-1 ring-white/10 shadow-2xl overflow-y-auto p-6 sm:p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-32 text-muted-foreground animate-pulse">Loading document...</div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-32 text-red-400">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>{error}</p>
              </div>
            ) : (
              <div className="prose prose-zinc dark:prose-invert max-w-none prose-pre:bg-accent/50 prose-pre:border prose-pre:border-border prose-a:text-blue-500 hover:prose-a:text-blue-400 prose-headings:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdownContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (resource.content) {
      return (
        <div className="w-full max-w-4xl h-[85vh] bg-background rounded-2xl ring-1 ring-white/10 shadow-2xl overflow-y-auto p-6 sm:p-12 custom-scrollbar flex flex-col gap-8">
          <div className="prose prose-zinc dark:prose-invert max-w-none prose-pre:bg-accent/50 prose-pre:border prose-pre:border-border prose-a:text-blue-500 hover:prose-a:text-blue-400 prose-headings:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {resource.content}
            </ReactMarkdown>
          </div>
          {resource.attachments && resource.attachments.length > 0 && (
            <div className="flex flex-wrap gap-4 pt-6 border-t border-white/10">
              {resource.attachments.map((att, idx) => {
                const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
                return (
                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-lg ring-1 ring-white/10 hover:ring-blue-500/50 transition-all bg-black/20 w-32 h-32 flex items-center justify-center">
                    {isImg ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={att.url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                        <FileText className="w-8 h-8" />
                        <span className="text-[10px] truncate max-w-[100px] font-medium">{att.fileName || 'File'}</span>
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Use native browser PDF viewer for PDFs, fallback to Google Docs Viewer for DOCX/XLSX
    const isPdf = resource.title.toLowerCase().endsWith('.pdf') || resource.url.toLowerCase().includes('.pdf');
    const viewerUrl = isPdf 
      ? resource.url 
      : `https://docs.google.com/viewer?url=${encodeURIComponent(resource.url)}&embedded=true`;
      
    return (
      <div className="w-full max-w-6xl h-full bg-white rounded-2xl ring-1 ring-white/10 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-500">
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Loading document viewer...</span>
          </div>
        </div>
        <iframe 
          src={viewerUrl} 
          className="w-full h-full relative z-10 border-0" 
          title={resource.title}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      {/* Floating Controls Overlay */}
      <div className="absolute top-0 left-0 right-0 h-24 px-8 flex items-start pt-5 justify-between z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 drop-shadow-md">
          {resource.category !== 'image' && (
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg text-white">
              <FileText className="w-4 h-4" />
            </div>
          )}
          <h3 className="font-medium text-white/90 text-lg tracking-wide">{resource.title}</h3>
        </div>
        
        <div className="flex items-center gap-3 pointer-events-auto">
          {resource.url && resource.url !== '#' && resource.url !== resource.title && (
            <a 
              href={resource.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all hover:scale-105 active:scale-95"
              title="Download / Open Original"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          <button 
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white transition-all hover:scale-105 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full h-full pt-20 pb-8 px-8 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full h-full flex items-center justify-center">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
