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
  getAdjacentTopics,
  deleteCapturePermanently,
  deleteMultipleCapturesPermanently,
  getTopicLinks,
  deleteTopicMention,
  addTopicMention,
  searchTopicsInSubject,
  searchAllSubjects,
  getAllSubjectsForMention,
  getAllTopicsInSubjectForMention
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

export {
  createCapture,
  getCaptures,
  togglePinCapture,
  toggleTaskStatus,
  deleteCapture,
  getWorkspaceNoteCategories,
  generateCaptureAI,
  updateCapture,
  createCaptureWithFiles,
  renameCapture,
  createTextCaptureLink,
} from './capture.actions';

export {
  getTimeBlocks,
  createTimeBlock,
  deleteTimeBlock,
  getTasksAndRevisionsForMonth,
} from './planner.actions';
