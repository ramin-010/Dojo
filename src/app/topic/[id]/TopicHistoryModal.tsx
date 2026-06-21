import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Calendar, CheckCircle2, PlayCircle } from 'lucide-react';
import { TopicWorkspaceProps } from './TopicWorkspace'; // Assuming we export it or we can just import the type or use any for now. Actually let's redefine the type needed or import it.

// Let's define the minimum topic shape needed for this modal.
type TopicHistoryData = {
  createdAt: string | Date;
  revisions: {
    id: string;
    cycleNumber: number;
    intervalDays: number;
    scheduledFor: string | Date;
    completedAt: string | Date | null;
    status: string;
  }[];
};

interface TopicHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: TopicHistoryData;
}

export function TopicHistoryModal({ isOpen, onClose, topic }: TopicHistoryModalProps) {
  // Find the next revision
  const nextRevision = [...topic.revisions]
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
    .find(r => r.status === 'pending');

  const getDaysDiffFromToday = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" 
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-[#121212] border border-white/10 shadow-2xl rounded-2xl w-full max-w-3xl flex flex-col overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-2">
              <h2 className="text-[15px] font-semibold flex items-center gap-2 text-white/90">
                <Info className="w-5 h-5 text-blue-400" /> Topic History
              </h2>
              <button 
                onClick={onClose} 
                className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex flex-col md:flex-row h-full max-h-[75vh]">
              
              {/* Left Column */}
              <div className="w-full md:w-2/5 px-6 pb-6 pt-4 border-r border-white/5 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                
                {/* Overview */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs tracking-wider uppercase font-semibold text-white/40 mb-1">Overview</h3>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] text-white/50 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Created At
                    </span>
                    <span className="font-medium text-[15px] text-white/90 ml-6">
                      {new Date(topic.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-[13px] text-white/50 flex items-center gap-2">
                      <PlayCircle className="w-4 h-4" /> Revisions Started
                    </span>
                    <span className="font-medium text-[15px] text-emerald-400 ml-6">
                      {topic.revisions.length > 0 ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-[13px] text-white/50 flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/50 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                      </div> Total Cycles
                    </span>
                    <span className="font-medium text-[15px] text-white/90 ml-6">
                      {topic.revisions.length}
                    </span>
                  </div>
                </div>

                {/* Next Revision */}
                {nextRevision && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs tracking-wider uppercase font-semibold text-white/40">Next Revision</h3>
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-white/50" />
                        <span className="font-medium text-white/90">
                          {new Date(nextRevision.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {(() => {
                        const daysDiff = getDaysDiffFromToday(new Date(nextRevision.scheduledFor));
                        if (daysDiff === 0) return <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-md font-medium">Today</span>;
                        if (daysDiff === 1) return <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-md font-medium">Tomorrow</span>;
                        if (daysDiff < 0) return <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-md font-medium">Overdue</span>;
                        return <span className="bg-white/5 text-white/50 text-xs px-2.5 py-1 rounded-md font-medium">In {daysDiff} days</span>;
                      })()}
                    </div>
                  </div>
                )}

                {/* About Cycles */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                    <Info className="w-4 h-4" /> About Cycles
                  </div>
                  <p className="text-[13px] text-white/40 leading-relaxed pl-6">
                    Each cycle represents a complete revision of this topic. The next revision is scheduled based on your spaced repetition settings.
                  </p>
                </div>

              </div>

              {/* Right Column */}
              <div className="w-full md:w-3/5 px-6 pb-6 pt-4 overflow-y-auto custom-scrollbar relative bg-[#0f0f0f]">
                <h3 className="text-xs tracking-wider uppercase font-semibold text-white/40 mb-6">Revision Timeline</h3>
                
                {topic.revisions.length === 0 ? (
                  <div className="text-sm text-white/40 italic mt-4">No revisions started yet.</div>
                ) : (
                  <div className="flex flex-col relative pl-2 pb-6">
                    {topic.revisions.map((rev, idx) => {
                      const isCompleted = rev.status === 'done';
                      
                      return (
                        <div key={rev.id} className="flex gap-4 relative mb-8 group">
                          
                          {/* Dynamic Progress Line (Connects to next node) */}
                          {idx < topic.revisions.length - 1 && (
                            <div className="absolute left-[15px] top-[34px] bottom-[-32px] w-[2px] bg-white/5 z-0">
                              <div 
                                className="w-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-1000 rounded-b-full" 
                                style={{ height: `${(() => {
                                  const currentRev = rev;
                                  const nextRev = topic.revisions[idx + 1];
                                  if (currentRev.status !== 'done') return 0;
                                  if (nextRev.status === 'done') return 100;
                                  
                                  const start = new Date(currentRev.completedAt || currentRev.scheduledFor).getTime();
                                  const end = new Date(nextRev.scheduledFor).getTime();
                                  const now = new Date().getTime();
                                  
                                  if (now >= end) return 100;
                                  if (now <= start) return 0;
                                  
                                  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
                                })()}%` }}
                              />
                            </div>
                          )}
                          
                          {/* Icon Container with background to hide the vertical line */}
                          <div className="relative shrink-0 w-[32px] h-[32px] rounded-full flex items-center justify-center bg-[#0f0f0f] z-10 mt-0.5">
                            <div className={`w-[32px] h-[32px] rounded-full border flex items-center justify-center transition-colors
                              ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                              {isCompleted ? (
                                <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400" />
                              ) : (
                                <Calendar className="w-[16px] h-[16px] text-white/40" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col flex-1 pt-1">
                            {/* Title & Badge Row */}
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-[15px] font-semibold text-white/90 flex items-center gap-2">
                                Cycle {rev.cycleNumber} <span className="text-white/40 font-normal text-[13px]">({rev.intervalDays} days)</span>
                              </span>
                              {isCompleted ? (
                                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-md shrink-0">
                                  Completed
                                </span>
                              ) : (
                                <span className="bg-white/5 text-white/40 text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-md shrink-0">
                                  Upcoming
                                </span>
                              )}
                            </div>

                            {/* Dates Container */}
                            <div className="flex flex-col gap-1.5 mt-3">
                              <span className="text-[13px] text-white/50 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> 
                                Scheduled: {new Date(rev.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              
                              {isCompleted && rev.completedAt && (
                                <span className="text-[13px] text-white/70 flex items-center gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white/50" />
                                  Completed: {new Date(rev.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  
                                  {/* Early/Late Indicator */}
                                  {(() => {
                                    const s = new Date(rev.scheduledFor);
                                    s.setHours(0,0,0,0);
                                    const c = new Date(rev.completedAt);
                                    c.setHours(0,0,0,0);
                                    const diff = Math.round((c.getTime() - s.getTime()) / 86400000);
                                    if (diff === 0) return <span className="text-white/30 ml-1">(on time)</span>;
                                    if (diff < 0) return <span className="text-blue-400/80 ml-1 font-medium">({Math.abs(diff)}d early)</span>;
                                    return <span className="text-amber-400/80 ml-1 font-medium">({diff}d late)</span>;
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
