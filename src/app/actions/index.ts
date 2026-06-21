// Barrel file – re-exports every server action so existing imports
// like `import { createTopic } from '@/app/actions'` keep working.

export {
  getSubjectsWithTopics,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} from './subject.actions';

export {
  createTopic,
  getTopicById,
  saveCanvasData,
  updateTopic,
  deleteTopic,
  reorderTopics,
} from './topic.actions';

export {
  startTopicRevisions,
  completeRevision,
} from './revision.actions';

export {
  getRecentActivity,
  getSubjectStreak,
  getDailyHistory,
} from './analytics.actions';

export {
  searchTags,
  getAllSubjectTags,
} from './tag.actions';
