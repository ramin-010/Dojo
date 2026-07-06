'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, ArrowRight, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { getUnresolvedWeeklyGoals, shiftWeeklyGoal } from '@/app/actions/capture.actions';
import { toast } from 'sonner';

export function WeeklyReviewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [goals, setGoals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchGoals = async () => {
      try {
        const res = await getUnresolvedWeeklyGoals();
        if (res.success && res.goals && res.goals.length > 0 && mounted) {
          setGoals(res.goals);
          setIsOpen(true);
        }
      } catch (e) {
        console.error('Failed to fetch weekly goals', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    // Only run this check on Monday
    const now = new Date();
    if (now.getDay() === 1) { // 1 is Monday
      fetchGoals();
    } else {
      setIsLoading(false);
    }

    return () => { mounted = false; };
  }, []);

  const handleShift = async (goalId: string, target: 'THIS_WEEK' | 'MONTHLY') => {
    setProcessingId(goalId);
    try {
      const res = await shiftWeeklyGoal(goalId, target);
      if (res.success) {
        toast.success(target === 'THIS_WEEK' ? 'Shifted to this week' : 'Shifted to monthly goals');
        setGoals(prev => prev.filter(g => g.id !== goalId));
        if (goals.length <= 1) {
          setIsOpen(false);
        }
      } else {
        toast.error('Failed to shift goal');
      }
    } catch (e) {
      toast.error('Failed to shift goal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDone = async (goalId: string) => {
    setProcessingId(goalId);
    try {
      const { toggleTaskStatus } = await import('@/app/actions/capture.actions');
      await toggleTaskStatus(goalId, true);
      toast.success('Marked as done!');
      setGoals(prev => prev.filter(g => g.id !== goalId));
      if (goals.length <= 1) {
        setIsOpen(false);
      }
    } catch (e) {
      toast.error('Failed to mark as done');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen || isLoading) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-sidebar border border-divider shadow-2xl overflow-hidden flex flex-col rounded-2xl relative"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-divider/50 bg-gradient-to-r from-blue-500/10 to-transparent">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Unresolved Weekly Goals
            </h2>
            <p className="text-[13px] text-foreground/50 mt-1">
              You have {goals.length} goal{goals.length !== 1 ? 's' : ''} carrying over from last week. Let's organize them.
            </p>
          </div>

          {/* List */}
          <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {goals.map(goal => (
              <div key={goal.id} className="bg-background border border-divider rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                {processingId === goal.id && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm truncate">{goal.title}</h3>
                    {goal.category && (
                      <span className="text-[10px] text-foreground/40 font-medium tracking-wide">
                        #{goal.category.name}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDone(goal.id)}
                    className="shrink-0 p-1.5 text-foreground/20 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors group/btn"
                    title="Mark as done"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2 w-full mt-1">
                  <button 
                    onClick={() => handleShift(goal.id, 'THIS_WEEK')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/20"
                  >
                    Shift to This Week <ArrowRight className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => handleShift(goal.id, 'MONTHLY')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium transition-colors border border-purple-500/20"
                  >
                    Make it Monthly <CalendarDays className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="px-4 pb-4 pt-2">
             <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 text-xs text-foreground/40 hover:text-foreground font-medium transition-colors"
             >
                I'll organize these later
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
