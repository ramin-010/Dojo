import { TaskStats } from './smartBlockTypes';

export const calculateTaskStats = (content: string): TaskStats | null => {
  if (!content) return null;
  const total = (content.match(/data-type="taskItem"/g) || []).length;
  if (total === 0) return null;
  const checked = (content.match(/data-checked="true"/g) || []).length;
  return { total, checked, progress: Math.round((checked / total) * 100) };
};
