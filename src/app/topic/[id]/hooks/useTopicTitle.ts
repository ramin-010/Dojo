// Place this file at:  src/app/topic/[id]/hooks/useTopicTitle.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { updateTopic } from '@/app/actions';
import { useAppStore } from '@/store/useAppStore';

interface UseTopicTitleParams {
  topicId: string;
  subjectId: string;
  initialTitle: string;
}

interface UseTopicTitleReturn {
  title: string;
  setTitle: (t: string) => void;
  isEditingTitle: boolean;
  setIsEditingTitle: (v: boolean) => void;
  titleInputRef: React.RefObject<HTMLHeadingElement | null>;
  /** Pass directly to dangerouslySetInnerHTML — stable ref, never resets mid-type */
  initialTitleHtml: React.MutableRefObject<{ __html: string }>;
}

export function useTopicTitle({
  topicId,
  subjectId,
  initialTitle,
}: UseTopicTitleParams): UseTopicTitleReturn {
  const { updateTopicTitle, setIsSaving } = useAppStore();

  const [title, setTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLHeadingElement>(null);

  // Stable ref for dangerouslySetInnerHTML — prevents React from re-setting
  // the DOM while the user is mid-typing inside the contentEditable h1.
  const prevTopicId = useRef(topicId);
  const initialTitleHtml = useRef<{ __html: string }>({
    __html: initialTitle || 'Untitled Topic',
  });

  // When navigating to a different topic, reset the stable HTML ref
  if (prevTopicId.current !== topicId) {
    prevTopicId.current = topicId;
    initialTitleHtml.current = { __html: initialTitle || 'Untitled Topic' };
  }

  // Debounced save — only fires when title differs from the server value
  useEffect(() => {
    if (title === initialTitle) return;
    const timer = setTimeout(async () => {
      setIsSaving(true);
      await updateTopic(topicId, { title });
      setIsSaving(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, topicId, initialTitle, setIsSaving]);

  // Expose a setter that also keeps the Zustand sidebar store in sync
  const handleSetTitle = (newTitle: string) => {
    setTitle(newTitle);
    updateTopicTitle(subjectId, topicId, newTitle);
  };

  return {
    title,
    setTitle: handleSetTitle,
    isEditingTitle,
    setIsEditingTitle,
    titleInputRef,
    initialTitleHtml,
  };
}