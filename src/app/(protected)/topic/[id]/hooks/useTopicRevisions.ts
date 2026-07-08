// Place this file at:  src/app/topic/[id]/hooks/useTopicRevisions.ts
'use client';

import { useMemo, useTransition } from 'react';
import { startTopicRevisions, completeRevision } from '@/app/actions';
import { TopicRevision, RevisionButtonState } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseTopicRevisionsParams {
  topicId: string;
  revisions: TopicRevision[];
}

interface UseTopicRevisionsReturn {
  nextPendingRevision: TopicRevision | null;
  nextDueText: string;
  revisionButtonState: RevisionButtonState;
  revisionButtonText: string;
  handleRevisionAction: () => void;
  isPending: boolean;
}

export function useTopicRevisions({
  topicId,
  revisions,
}: UseTopicRevisionsParams): UseTopicRevisionsReturn {
  const [isPending, startTransition] = useTransition();

  // ── Derive next pending revision ──────────────────────────────────────────
  const nextPendingRevision = useMemo(() => {
    return (
      revisions
        .filter((r) => r.status === 'pending')
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
        )[0] ?? null
    );
  }, [revisions]);

  // ── Human-readable due text ───────────────────────────────────────────────
  const nextDueText = useMemo(() => {
    if (!nextPendingRevision) return 'Completed';
    const due = new Date(nextPendingRevision.scheduledFor);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueMidnight = new Date(due);
    dueMidnight.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(
      (dueMidnight.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) return formatDate(due);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return formatDate(due);
  }, [nextPendingRevision]);

  // ── Button state + action ─────────────────────────────────────────────────
  const { revisionButtonState, revisionButtonText, handleRevisionAction } =
    useMemo(() => {
      if (revisions.length === 0) {
        return {
          revisionButtonState: 'start' as RevisionButtonState,
          revisionButtonText: 'Start Revisions',
          handleRevisionAction: () => {
            startTransition(async () => {
              await startTopicRevisions(topicId);
            });
          },
        };
      }

      if (!nextPendingRevision) {
        return {
          revisionButtonState: 'completed' as RevisionButtonState,
          revisionButtonText: 'Completed',
          handleRevisionAction: () => {},
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduled = new Date(nextPendingRevision.scheduledFor);
      scheduled.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil(
        (scheduled.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays >= 2) {
        return {
          revisionButtonState: 'wait' as RevisionButtonState,
          revisionButtonText: `Next Revision: ${formatDate(scheduled)}`,
          handleRevisionAction: () => {},
        };
      }

      if (diffDays === 1) {
        return {
          revisionButtonState: 'early' as RevisionButtonState,
          revisionButtonText: 'Revise Early',
          handleRevisionAction: () => {
            startTransition(async () => {
              await completeRevision(nextPendingRevision.id);
            });
          },
        };
      }

      return {
        revisionButtonState: 'due' as RevisionButtonState,
        revisionButtonText: 'Mark as Revised',
        handleRevisionAction: () => {
          startTransition(async () => {
            await completeRevision(nextPendingRevision.id);
          });
        },
      };
    }, [revisions.length, topicId, nextPendingRevision]);

  return {
    nextPendingRevision,
    nextDueText,
    revisionButtonState,
    revisionButtonText,
    handleRevisionAction,
    isPending,
  };
}