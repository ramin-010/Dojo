'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Attempt to enter fullscreen
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.log("Fullscreen request failed:", err);
        });
      }
    } catch (e) {
      console.log(e);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Attempt to exit fullscreen
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch((err) => {
            console.log("Exit fullscreen failed:", err);
          });
        }
      } catch (e) {
        console.log(e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!resource || !mounted) return null;

  const renderContent = () => {
    if (resource.category === 'image') {
      return (
        <img 
          src={resource.url === '#' && resource.thumbnailUrl ? resource.thumbnailUrl : resource.url} 
          alt={resource.title} 
          className="max-w-full max-h-full object-contain drop-shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-md ring-1 ring-border/50 select-none animate-in zoom-in-95 duration-300"
        />
      );
    }

    if (resource.url === '#' && !resource.title.toLowerCase().endsWith('.md')) {
      return (
        <div className="w-full max-w-3xl h-full bg-background/80 backdrop-blur-md rounded-none ring-1 ring-border/50 flex flex-col items-center justify-center text-muted shadow-2xl">
          <FileText className="w-16 h-16 mb-6 opacity-20 text-foreground" />
          <p className="font-semibold text-foreground text-lg">Preview not available</p>
          <p className="text-sm mt-2 opacity-70">Real URLs will load seamlessly in the document viewer.</p>
        </div>
      );
    }

    if (resource.title.toLowerCase().endsWith('.md')) {
      return (
        <div className="w-full max-w-5xl h-full bg-background rounded-none ring-1 ring-border/50 shadow-2xl overflow-y-auto p-6 sm:p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-32 text-muted animate-pulse">Loading document...</div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-32 text-red-400">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>{error}</p>
              </div>
            ) : (
              <div className="prose max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-li:text-foreground prose-a:text-blue-500 hover:prose-a:text-blue-400 prose-pre:bg-foreground/10 prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-code:text-foreground prose-blockquote:text-foreground/80 prose-blockquote:border-foreground/30 prose-hr:border-border">
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
        <div className="w-full max-w-4xl h-full bg-background rounded-none ring-1 ring-border/50 shadow-2xl overflow-y-auto p-6 sm:p-12 custom-scrollbar flex flex-col gap-8">
          <div className="prose max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-li:text-foreground prose-a:text-blue-500 hover:prose-a:text-blue-400 prose-pre:bg-foreground/10 prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-code:text-foreground prose-blockquote:text-foreground/80 prose-blockquote:border-foreground/30 prose-hr:border-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {resource.content}
            </ReactMarkdown>
          </div>
          {resource.attachments && resource.attachments.length > 0 && (
            <div className="flex flex-wrap gap-4 pt-6 border-t border-border">
              {resource.attachments.map((att, idx) => {
                const isImg = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || att.fileType?.startsWith('image/');
                return (
                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-lg ring-1 ring-border/50 hover:ring-blue-500/50 transition-all bg-foreground/5 w-32 h-32 flex items-center justify-center">
                    {isImg ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={att.url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted group-hover:text-foreground transition-colors">
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
      <div className="w-full max-w-6xl h-full bg-background rounded-none ring-1 ring-border/50 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center bg-background text-muted">
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

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      {/* Floating Action Buttons */}
      <div className="absolute top-6 right-8 flex items-center gap-3 z-[1000] pointer-events-auto drop-shadow-lg">
        {resource.url && resource.url !== '#' && resource.url !== resource.title && (
          <a 
            href={resource.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center w-11 h-11 bg-background hover:bg-hover backdrop-blur-md rounded-full text-foreground transition-all ring-1 ring-border hover:scale-105 active:scale-95 shadow-xl"
            title="Download / Open Original"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        <button 
          onClick={onClose}
          className="flex items-center justify-center w-11 h-11 bg-background hover:bg-red-500 hover:text-white backdrop-blur-md rounded-full text-foreground transition-all ring-1 ring-border hover:scale-105 active:scale-95 shadow-xl"
          title="Close Preview (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full h-full px-2 sm:px-4 py-0 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full h-full flex items-center justify-center">
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
}
