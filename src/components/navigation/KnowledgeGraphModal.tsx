'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Dynamically import react-force-graph-2d since it uses canvas and needs to be client-side only
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface TopicData {
  id: string;
  title: string;
  tags: string[];
}

interface KnowledgeGraphModalProps {
  topics: TopicData[];
  onClose: () => void;
}

export function KnowledgeGraphModal({ topics, onClose }: KnowledgeGraphModalProps) {
  const router = useRouter();
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    // Escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Initial resize
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [onClose]);

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    
    // Tag map to group topics
    const tagToTopics: Record<string, string[]> = {};

    topics.forEach(t => {
      // Add topic node
      nodes.push({
        id: t.id,
        name: t.title,
        type: 'topic',
        val: 1.5,
        color: '#4F46E5', // Accent color
      });

      // Track tags
      t.tags.forEach(tag => {
        const cleanedTag = tag.replace('#', '');
        if (!tagToTopics[cleanedTag]) {
          tagToTopics[cleanedTag] = [];
        }
        tagToTopics[cleanedTag].push(t.id);
      });
    });

    // Add Tag Nodes and links
    Object.keys(tagToTopics).forEach(tag => {
      const topicIds = tagToTopics[tag];
      
      // Only create a tag node if it connects at least two topics, 
      // or if you want all tags visible, just create it regardless.
      if (topicIds.length > 0) {
        const tagNodeId = `tag-${tag}`;
        nodes.push({
          id: tagNodeId,
          name: `#${tag}`,
          type: 'tag',
          val: 0.8 + (topicIds.length * 0.2), // Size scales with connections
          color: '#3B82F6', // Lighter blue
        });

        // Link topic to tag
        topicIds.forEach(tid => {
          links.push({
            source: tid,
            target: tagNodeId,
            color: 'rgba(255,255,255,0.15)'
          });
        });
      }
    });

    return { nodes, links };
  }, [topics]);

  // Center graph after rendering
  useEffect(() => {
    if (graphRef.current) {
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 50);
      }, 500);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="text-2xl">🕸️</span> Knowledge Graph
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Visualizing relationships across {topics.length} topics. Click a node to open it.
          </p>
        </div>
        
        <button 
          onClick={onClose}
          className="pointer-events-auto p-3 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Graph Container */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        {typeof window !== 'undefined' && (
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeColor="color"
            linkColor="color"
            linkWidth={1}
            nodeRelSize={6}
            backgroundColor="transparent"
            onNodeClick={(node) => {
              if (node.type === 'topic') {
                router.push(`/topic/${node.id}`);
              }
            }}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.name;
              const fontSize = node.type === 'tag' ? 12 / globalScale : 14 / globalScale;
              
              ctx.font = `${node.type === 'topic' ? 'bold' : 'normal'} ${fontSize}px Inter, sans-serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              ctx.beginPath();
              ctx.roundRect(
                node.x - bckgDimensions[0] / 2,
                node.y - bckgDimensions[1] / 2,
                bckgDimensions[0],
                bckgDimensions[1],
                4 / globalScale
              );
              ctx.fill();

              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = node.color;
              ctx.fillText(label, node.x, node.y);
              
              node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
            }}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              const bckgDimensions = node.__bckgDimensions;
              if (bckgDimensions) {
                ctx.fillRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y - bckgDimensions[1] / 2,
                  bckgDimensions[0],
                  bckgDimensions[1]
                );
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
