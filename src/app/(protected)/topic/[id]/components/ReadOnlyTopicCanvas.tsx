'use client';

import React, { useEffect, useState, useRef } from 'react';
import { TopicEditor } from '@/components/canvas/TopicEditor';
import { getTopicById } from '@/app/actions';
import { Loader2 } from 'lucide-react';

interface ReadOnlyTopicCanvasProps {
  topicId: string;
}

export function ReadOnlyTopicCanvas({ topicId }: ReadOnlyTopicCanvasProps) {
  const [loading, setLoading] = useState(true);
  const [topicData, setTopicData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    let isMounted = true;
    
    async function loadTopic() {
      try {
        setLoading(true);
        const data = await getTopicById(topicId);
        if (isMounted) {
          if (data) {
            setTopicData(data);
          } else {
            setError('Topic not found');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load topic');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTopic();

    return () => {
      isMounted = false;
    };
  }, [topicId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50" />
        <span className="text-sm font-medium">Loading canvas...</span>
      </div>
    );
  }

  if (error || !topicData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-destructive text-sm font-medium">
        {error || 'Failed to load topic'}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-background">
      <div className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="w-full max-w-5xl mx-auto pt-16 pb-16 px-4 sm:px-8">
          <TopicEditor
            topicId={topicData.id}
            subjectId={topicData.subjectId}
            initialContent={topicData.canvasData}
            readOnly={true}
            showTitle={true}
            title={topicData.title}
            containerWidth={containerWidth > 1024 ? 900 : containerWidth - 64}
          />
        </div>
      </div>
    </div>
  );
}
