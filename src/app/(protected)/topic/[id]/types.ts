// ─── Shared types for TopicWorkspace and its sub-components / hooks ───────────
// Place this file at:  src/app/topic/[id]/types.ts

export type SidebarTab = 'symlinks' | 'resources' | 'library';

export type SplitViewItemType = 'note' | 'resource' | 'topic_link';

export interface SplitViewData {
  type: SplitViewItemType;
  id: string;
  data: any; // The raw data of the dropped item
}

export interface TopicRevision {
  id: string;
  cycleNumber: number;
  intervalDays: number;
  scheduledFor: Date | string;
  completedAt: Date | string | null;
  status: string;
  createdAt: Date | string;
}

export interface TopicMentionOut {
  id: string;
  createdAt: Date | string;
  targetTopic: { id: string; title: string; updatedAt: Date | string; subjectId: string; subject: { name: string } };
}

export interface TopicMentionIn {
  id: string;
  createdAt: Date | string;
  sourceTopic: { id: string; title: string; updatedAt: Date | string; subjectId: string; subject: { name: string } };
}

export interface TopicResource {
  id: string;
  url: string;
  title: string;
  category: string;
  cloudPublicId?: string | null;
  fileType?: string | null;
  createdAt: Date | string;
}

export interface NoteCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface TopicQuickNote {
  id: string;
  content: string;
  title: string | null;
  isPinned: boolean;
  categoryId: string | null;
  category: NoteCategory | null;
  workspaceId: string;
  topicId: string | null;
  subjectId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Capture {
  id: string;
  type: 'NOTE' | 'LINK' | 'TASK';
  content: string | null;
  title: string | null;
  url: string | null;
  cloudPublicId?: string | null;
  fileType?: string | null;
  isPinned: boolean;
  categoryId: string | null;
  category: NoteCategory | null;
  attachments?: { url: string; fileType?: string | null; fileName?: string | null }[];
  topicId?: string | null;
  subjectId?: string | null;
  topic?: { title: string } | null;
  subject?: { name: string } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** The full topic shape that getTopicById returns (serialized from server) */
export interface Topic {
  id: string;
  title: string;
  tags: { id: string; name: string }[];
  canvasData: unknown;
  subjectId: string;
  sortOrder: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  subject: { id: string; name: string };
  revisions: TopicRevision[];
  mentionsOut: TopicMentionOut[];
  mentionsIn: TopicMentionIn[];
  captures: Capture[];
  captureLinks?: { capture: Capture }[];
}

export interface TopicWorkspaceProps {
  topic: Topic;
  allSubjectTags: {
    id: string;
    name: string;
  }[];
  adjacentTopics: {
    prev: { id: string; title: string } | null;
    next: { id: string; title: string } | null;
  };
  noteCategories: NoteCategory[];
}

// ─── Derived display types used across sidebar / links timeline ───────────────

export interface ContextLink {
  id: string;
  topicId: string;
  path: string;
  taggedAt: string;
  updatedAt: string;
}

export interface ContextLinks {
  outbound: ContextLink[];
  inbound: ContextLink[];
}

export interface QuickNoteDisplay {
  id: string;
  type: 'subject' | 'topic-same-subject' | 'topic-diff-subject';
  content: string;
  date: string;
  linkedItemTitle: string;
}

// ─── Revision button states ───────────────────────────────────────────────────

export type RevisionButtonState = 'start' | 'due' | 'early' | 'wait' | 'completed';