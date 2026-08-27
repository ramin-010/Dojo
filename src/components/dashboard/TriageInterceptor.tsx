'use client';

import { useMemo } from 'react';
import { DayDebriefModal } from './DayDebriefModal';
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

  if (!unverifiedBlocks || unverifiedBlocks.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar">
      <DayDebriefModal
        isOpen={true}
        onClose={onComplete}
        workspaceId={workspaceId}
        todaySlots={mappedSlots}
        date={targetDate}
        title="Action Required"
        subtitle={`${unverifiedBlocks.length} unresolved ${unverifiedBlocks.length === 1 ? 'block' : 'blocks'} from the past`}
      />
    </div>
  );
}
