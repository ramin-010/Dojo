// Place this file at:  src/app/topic/[id]/hooks/useTopicTags.ts
'use client';

import { useState, useEffect } from 'react';
import { updateTopic } from '@/app/actions';

interface Tag {
  id: string;
  name: string;
}

interface UseTopicTagsParams {
  topicId: string;
  initialTags: Tag[];
  allSubjectTags: Tag[];
}

interface UseTopicTagsReturn {
  tags: Tag[];
  isAddingTag: boolean;
  setIsAddingTag: (v: boolean) => void;
  newTagText: string;
  setNewTagText: (v: string) => void;
  suggestedTags: Tag[];
  handleCommitTag: (tagName: string) => Promise<void>;
  handleRemoveTag: (tagId: string) => Promise<void>;
}

export function useTopicTags({
  topicId,
  initialTags,
  allSubjectTags,
}: UseTopicTagsParams): UseTopicTagsReturn {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<Tag[]>([]);

  // Synchronous zero-latency client-side tag search
  useEffect(() => {
    if (!newTagText.trim()) {
      setSuggestedTags([]);
      return;
    }
    const results = allSubjectTags
      .filter((t) => t.name.toLowerCase().includes(newTagText.toLowerCase()))
      .slice(0, 10);
    setSuggestedTags(results);
  }, [newTagText, allSubjectTags]);

  const handleCommitTag = async (tagName: string) => {
    const tag = tagName.startsWith('#') ? tagName.trim() : `#${tagName.trim()}`;
    if (!tags.find((t) => t.name === tag)) {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const newTags = [...tags, { id: tempId, name: tag }];
      setTags(newTags);
      await updateTopic(topicId, { tags: newTags.map((t) => t.name) });
    }
    setNewTagText('');
    setIsAddingTag(false);
    setSuggestedTags([]);
  };

  const handleRemoveTag = async (tagId: string) => {
    const newTags = tags.filter((t) => t.id !== tagId);
    setTags(newTags);
    await updateTopic(topicId, { tags: newTags.map((t) => t.name) });
  };

  return {
    tags,
    isAddingTag,
    setIsAddingTag,
    newTagText,
    setNewTagText,
    suggestedTags,
    handleCommitTag,
    handleRemoveTag,
  };
}