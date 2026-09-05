'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import {
  parseNote,
  prettyUrl,
  type InlineNode,
  type NoteNode,
} from '@/lib/notes/parseNote';

// ─── Inline ───────────────────────────────────────────────────────────────

function LinkChip({ href, label, bare }: { href: string; label: string; bare: boolean }) {
  // A raw URL is unreadable and wraps across four lines. Show the host plus a
  // trimmed path instead, and keep the real thing in the tooltip.
  const display = bare ? prettyUrl(label) : label;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="group/link inline-flex max-w-full items-center gap-1 align-middle rounded-md border border-accent/20 bg-accent/8 px-1.5 py-[1px] font-medium text-accent no-underline transition-colors hover:border-accent/40 hover:bg-accent/15"
    >
      <span className="truncate">{display}</span>
      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40 transition-opacity group-hover/link:opacity-100" />
    </a>
  );
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return <React.Fragment key={i}>{n.value}</React.Fragment>;
          case 'code':
            return (
              <code
                key={i}
                className="rounded bg-foreground/8 px-1 py-[1px] font-mono text-[0.88em] text-accent"
              >
                {n.value}
              </code>
            );
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-foreground">
                <Inline nodes={n.children} />
              </strong>
            );
          case 'italic':
            return (
              <em key={i} className="italic">
                <Inline nodes={n.children} />
              </em>
            );
          case 'strike':
            return (
              <span key={i} className="line-through opacity-60">
                <Inline nodes={n.children} />
              </span>
            );
          case 'link':
            return <LinkChip key={i} href={n.href} label={n.label} bare={n.bare} />;
        }
      })}
    </>
  );
}

// ─── Code block ───────────────────────────────────────────────────────────

/**
 * Syntax highlighting is loaded on demand. highlight.js is a large dependency
 * and most dashboard sessions never render a code block, so importing it at
 * module scope would tax every page load for a minority of notes.
 */
function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState<string | null>(lang);

  useEffect(() => {
    let cancelled = false;
    import('highlight.js/lib/common')
      .then(({ default: hljs }) => {
        if (cancelled || !ref.current) return;
        try {
          const result =
            lang && hljs.getLanguage(lang)
              ? hljs.highlight(code, { language: lang })
              : hljs.highlightAuto(code);
          ref.current.innerHTML = result.value;
          if (!lang && result.language) setDetected(result.language);
        } catch {
          /* leave the plain-text fallback in place */
        }
      })
      .catch(() => {
        /* offline or chunk failed — plain text is still readable */
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  };

  return (
    <div
      className="note-code group/code relative my-2 overflow-hidden rounded-lg border border-divider bg-foreground/[0.045]"
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1.5">
        {detected && (
          <span className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted opacity-0 transition-opacity group-hover/code:opacity-100">
            {detected}
          </span>
        )}
        <button
          onClick={copy}
          title="Copy code"
          className="rounded-md bg-foreground/8 p-1.5 text-muted opacity-0 transition-all hover:bg-foreground/15 hover:text-foreground focus:opacity-100 group-hover/code:opacity-100"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <pre className="overflow-x-hidden px-3 py-2.5 pr-12">
        <code
          ref={ref}
          className="hljs block whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.6] text-foreground/90"
        >
          {code}
        </code>
      </pre>
    </div>
  );
}

// ─── Block ────────────────────────────────────────────────────────────────

function Block({ node, isFirst }: { node: NoteNode; isFirst: boolean }) {
  switch (node.type) {
    case 'heading':
      return (
        <h4
          className={`text-[14.5px] font-semibold leading-snug text-foreground ${isFirst ? '' : 'mt-3'} mb-1.5`}
        >
          <Inline nodes={node.children} />
        </h4>
      );

    case 'label':
      return (
        <p className={`text-[12.5px] font-semibold text-foreground/70 ${isFirst ? '' : 'mt-2.5'} mb-1`}>
          <Inline nodes={node.children} />
        </p>
      );

    case 'paragraph':
      return (
        <p className={`text-[13.5px] leading-relaxed text-foreground/85 ${isFirst ? '' : 'mt-2'}`}>
          {node.lines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              <Inline nodes={line} />
            </React.Fragment>
          ))}
        </p>
      );

    case 'list':
      return (
        <ul className={`flex flex-col gap-1 ${isFirst ? '' : 'mt-2'}`}>
          {node.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/85">
              <span className="mt-[0.55em] h-[3px] w-[3px] shrink-0 rounded-full bg-foreground/40" />
              <span className="min-w-0 flex-1">
                <Inline nodes={item.children} />
              </span>
            </li>
          ))}
        </ul>
      );

    case 'code':
      return <CodeBlock code={node.code} lang={node.lang} />;
  }
}

// ─── Public ───────────────────────────────────────────────────────────────

/**
 * Renders a Quick Note's raw text as structured content: bare code lines
 * become copyable code cards, URLs become compact chips, and the opening line
 * becomes a title. The source text is never rewritten — double-clicking still
 * puts the user back into the exact characters they typed.
 */
export function NoteContent({ content, className = '' }: { content: string; className?: string }) {
  const nodes = useMemo(() => parseNote(content), [content]);

  if (nodes.length === 0) return null;

  return (
    <div className={`w-full min-w-0 break-words ${className}`}>
      {nodes.map((node, i) => (
        <Block key={i} node={node} isFirst={i === 0} />
      ))}
    </div>
  );
}

export default NoteContent;
