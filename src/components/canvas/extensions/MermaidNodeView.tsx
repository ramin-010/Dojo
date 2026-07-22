'use client';

import React, { useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import mermaid from 'mermaid';
import { Edit2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MermaidNodeView({ node, updateAttributes }: any) {
  const code = node.attrs.code || 'graph TD;\n  A-->B;';
  const [isEditing, setIsEditing] = useState(false);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState('');

  // Initialize mermaid on mount
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        background: 'transparent',
        primaryColor: '#24283b',
        primaryTextColor: '#c0caf5',
        primaryBorderColor: 'rgba(122, 162, 247, 0.8)',
        lineColor: '#bb9af7',
        secondaryColor: '#1f2335',
        tertiaryColor: '#1a1b26',
        clusterBkg: 'rgba(31, 35, 53, 0.5)',
        clusterBorder: 'rgba(122, 162, 247, 0.4)',
        nodeBorder: 'rgba(122, 162, 247, 0.8)',
        mainBkg: '#24283b',
        textColor: '#c0caf5',
      },
      flowchart: {
        curve: 'basis', // Smooth bezier curves!
      },
      fontFamily: 'inherit',
      securityLevel: 'loose',
    });
  }, []);

  // Render when code changes and we are not editing
  useEffect(() => {
    if (isEditing) return;

    let isMounted = true;

    const renderDiagram = async () => {
      try {
        if (!code.trim()) {
          if (isMounted) setSvgContent('');
          return;
        }
        
        // Mermaid needs a unique ID for each render
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        
        if (isMounted) {
          setSvgContent(svg);
          setError('');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Syntax error in Mermaid diagram');
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code, isEditing]);

  return (
    <NodeViewWrapper className="mermaid-block relative my-8 rounded-[20px] border border-white/5 overflow-hidden group bg-black/10 shadow-sm transition-colors hover:bg-black/20">
      
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/70 hover:text-foreground backdrop-blur-md border border-white/10 shadow-sm transition-all"
          title={isEditing ? "Save & View" : "Edit Diagram Code"}
        >
          {isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
        </button>
      </div>

      {isEditing ? (
        <div className="p-5 flex flex-col gap-3 bg-[#1a1b26]/80 backdrop-blur-sm">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">Mermaid Syntax</div>
          <textarea
            value={code}
            onChange={(e) => updateAttributes({ code: e.target.value })}
            className="w-full min-h-[250px] p-4 rounded-xl bg-black/40 border border-white/5 focus:border-white/20 outline-none resize-y font-mono text-sm text-foreground/90 leading-relaxed shadow-inner"
            spellCheck={false}
          />
        </div>
      ) : (
        <div contentEditable={false} className="select-none p-8 min-h-[140px] flex items-center justify-center relative bg-transparent">
          {error ? (
            <div className="flex flex-col items-center gap-2 text-red-400 p-4 bg-red-500/10 rounded-lg max-w-full overflow-x-auto text-xs font-mono">
              <AlertCircle className="w-5 h-5 mb-1" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          ) : svgContent ? (
            <div 
              className="flex justify-center w-full max-w-full overflow-x-auto [&_svg]:max-w-full" 
              dangerouslySetInnerHTML={{ __html: svgContent }} 
            />
          ) : (
            <div className="text-muted-foreground text-sm">Empty diagram</div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
