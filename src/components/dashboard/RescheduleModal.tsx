'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import TasksCalendar from '@/app/(protected)/dashboard/planner/TasksCalendar';
import { rescheduleRevision } from '@/app/actions/planner.actions';
import { updateCapture, rescheduleReminder } from '@/app/actions/capture.actions';

export interface RescheduleTarget {
  id: string;
  type: 'task' | 'revision' | 'reminder';
  title: string;
}

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: RescheduleTarget | null;
  tasks: any[];
  revisions: any[];
  blocks: any[];
  initialRoutineMode: 'MASTER' | 'DAILY';
  onRescheduleComplete: () => void;
}

export default function RescheduleModal({ 
  isOpen, 
  onClose, 
  target, 
  tasks, 
  revisions, 
  blocks, 
  initialRoutineMode,
  onRescheduleComplete 
}: RescheduleModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !target) return null;

  const handleReschedule = async (newDate: Date) => {
    setIsLoading(true);
    try {
      if (target.type === 'task') {
        const targetDate = new Date(newDate);
        targetDate.setHours(23, 59, 59, 999);
        await updateCapture(target.id, { dueDate: targetDate });
      } else if (target.type === 'reminder') {
        const targetDate = new Date(newDate);
        targetDate.setHours(23, 59, 59, 999);
        await rescheduleReminder(target.id, targetDate);
      } else if (target.type === 'revision') {
        const targetDate = new Date(newDate);
        targetDate.setHours(0, 0, 0, 0);
        await rescheduleRevision(target.id, targetDate);
      }

      onRescheduleComplete();
      onClose();
    } catch (error) {
      console.error("Failed to reschedule target:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-divider/60 rounded-3xl w-full max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)] relative">
        
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 p-2 bg-sidebar/80 backdrop-blur border border-divider rounded-full text-foreground/50 hover:text-foreground hover:bg-hover transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <TasksCalendar 
            initialTasks={tasks}
            initialRevisions={revisions}
            initialBlocks={blocks}
            initialRoutineMode={initialRoutineMode}
            mode="reschedule"
            rescheduleTargetName={target.title}
            onReschedule={handleReschedule}
            isRescheduling={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
