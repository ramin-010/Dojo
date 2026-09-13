'use client';

import { useMemo, useState } from 'react';
import { DayDebriefModal } from './DayDebriefModal';
import { MultiDayCatchUpModal } from './MultiDayCatchUpModal';
import { ScheduleSlotProp } from '@/app/(protected)/dashboard/DashboardClient';

export interface UnverifiedBlock {
  slot: {
    id: string;
    sourceBlockId: string | null;
    title: string;
    startTime: string;
    endTime: string;
    color: string;
    remark: string | null;
  };
  date: Date;
}

interface TriageInterceptorProps {
  unverifiedBlocks: UnverifiedBlock[];
  workspaceId: string;
  onComplete: () => void;
}

export function TriageInterceptor({ unverifiedBlocks, workspaceId, onComplete }: TriageInterceptorProps) {
  // Non-blocking: dismissing (backdrop click, Escape, X, Cancel) only hides
  // the prompt for this page visit — nothing is saved or marked resolved,
  // so `unverifiedBlocks` is unchanged and the same prompt returns on the
  // next full load or dashboard revisit (this component remounts fresh
  // either way). A real save still goes through onComplete, which refetches.
  const [dismissed, setDismissed] = useState(false);

  // Determine how many unique dates are involved
  const uniqueDates = useMemo(() => {
    const dateSet = new Set(
      (unverifiedBlocks || []).map(b => new Date(b.date).toISOString().split('T')[0])
    );
    return Array.from(dateSet).sort();
  }, [unverifiedBlocks]);

  // For single-day triage: map to ScheduleSlotProp[]
  const targetDate = useMemo(() => {
    if (!unverifiedBlocks || unverifiedBlocks.length === 0) return new Date();
    const dates = unverifiedBlocks.map(b => new Date(b.date).getTime());
    return new Date(Math.max(...dates));
  }, [unverifiedBlocks]);

  const mappedSlots: ScheduleSlotProp[] = useMemo(() => {
    return (unverifiedBlocks || []).map((b, i) => ({
      id: b.slot.id,
      sourceBlockId: b.slot.sourceBlockId,
      date: b.date,
      title: b.slot.title,
      color: b.slot.color,
      startTime: b.slot.startTime,
      endTime: b.slot.endTime,
      status: 'UPCOMING',
      remark: b.slot.remark,
      minutesDone: null,
      actualStartTime: null,
      actualEndTime: null,
      sortOrder: i,
    }));
  }, [unverifiedBlocks]);

  // For multi-day triage: group blocks by date
  const blocksByDate = useMemo(() => {
    const grouped: Record<string, Array<{
      id: string;
      sourceBlockId: string | null;
      title: string;
      startTime: string;
      endTime: string;
      color: string;
    }>> = {};

    for (const b of (unverifiedBlocks || [])) {
      const dateKey = new Date(b.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        id: b.slot.id,
        sourceBlockId: b.slot.sourceBlockId,
        title: b.slot.title,
        startTime: b.slot.startTime,
        endTime: b.slot.endTime,
        color: b.slot.color,
      });
    }

    return grouped;
  }, [unverifiedBlocks]);

  if (!unverifiedBlocks || unverifiedBlocks.length === 0 || dismissed) return null;

  // Multi-day: 2+ unique dates → show the catch-up modal
  if (uniqueDates.length >= 2) {
    return (
      <MultiDayCatchUpModal
        isOpen={true}
        onClose={onComplete}
        onDismiss={() => setDismissed(true)}
        workspaceId={workspaceId}
        blocksByDate={blocksByDate}
      />
    );
  }

  // Single-day: use the existing DayDebriefModal as Action Required.
  // DayDebriefModal renders its own backdrop, so it's used directly here —
  // wrapping it in a second one used to stack two overlays on top of each other.
  return (
    <DayDebriefModal
      isOpen={true}
      onClose={onComplete}
      onDismiss={() => setDismissed(true)}
      workspaceId={workspaceId}
      todaySlots={mappedSlots}
      date={targetDate}
      title="Action Required"
      subtitle={`${unverifiedBlocks.length} unresolved ${unverifiedBlocks.length === 1 ? 'block' : 'blocks'} from the past`}
    />
  );
}
