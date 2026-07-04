'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import WeeklyTimetable from './WeeklyTimetable';
import TasksCalendar from './TasksCalendar';
import RescheduleModal, { RescheduleTarget } from '@/components/dashboard/RescheduleModal';
import { VacationModal } from '@/components/dashboard/VacationModal';
import { Plane } from 'lucide-react';

interface PlannerClientProps {
  initialBlocks: any[];
  initialTasks: any[];
  initialRevisions: any[];
  initialRoutineMode: 'MASTER' | 'DAILY';
}

export default function PlannerClient({ initialBlocks, initialTasks, initialRevisions, initialRoutineMode }: PlannerClientProps) {
  const [activeTab, setActiveTab] = useState<'timetable' | 'calendar'>('timetable');
  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleTarget | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);

  return (
    <div className="p-8 max-w-[1100px] mx-auto w-full h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Planner</h1>
            <p className="text-foreground/50 text-sm mt-1">
              Organize your weekly routine and upcoming tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsVacationModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent hover:bg-accent/20 rounded-md transition-colors text-sm font-semibold"
            >
              <Plane className="w-4 h-4" />
              Vacation Mode
            </button>
            <button className="p-2 text-foreground/40 hover:text-foreground hover:bg-hover rounded-md transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Sleek Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-6 border-b border-divider/40">
          <button
            onClick={() => setActiveTab('timetable')}
            className={`pb-3 text-[13px] font-semibold transition-all relative ${
              activeTab === 'timetable'
                ? 'text-foreground'
                : 'text-foreground/40 hover:text-foreground/70'
            }`}
          >
            Weekly Timetable
            {activeTab === 'timetable' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-3 text-[13px] font-semibold transition-all relative ${
              activeTab === 'calendar'
                ? 'text-foreground'
                : 'text-foreground/40 hover:text-foreground/70'
            }`}
          >
            Tasks & Calendar
            {activeTab === 'calendar' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 relative">
        {activeTab === 'timetable' ? (
          <WeeklyTimetable initialBlocks={initialBlocks} initialRoutineMode={initialRoutineMode} />
        ) : (
          <TasksCalendar 
            initialTasks={initialTasks} 
            initialRevisions={initialRevisions} 
            initialBlocks={initialBlocks}
            initialRoutineMode={initialRoutineMode} 
            onRescheduleItem={setRescheduleTarget}
            refreshTrigger={refreshTrigger}
          />
        )}
      </main>

      {rescheduleTarget && (
        <RescheduleModal
          isOpen={true}
          onClose={() => setRescheduleTarget(null)}
          target={rescheduleTarget}
          tasks={initialTasks}
          revisions={initialRevisions}
          blocks={initialBlocks}
          initialRoutineMode={initialRoutineMode}
          onRescheduleComplete={() => setRefreshTrigger(prev => prev + 1)}
        />
      )}

      <VacationModal 
        isOpen={isVacationModalOpen} 
        onClose={() => setIsVacationModalOpen(false)} 
      />
    </div>
  );
}
