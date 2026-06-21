import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Calendar, Check, CheckCircle2, Clock, Flag, LayoutGrid, GitBranch } from 'lucide-react';

type TopicHistoryData = {
  createdAt: string | Date;
  revisions: {
    id: string;
    cycleNumber: number;
    intervalDays: number;
    scheduledFor: string | Date;
    completedAt: string | Date | null;
    status: string;
    createdAt: string | Date;
  }[];
};

interface TopicHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: TopicHistoryData;
}

export function TopicHistoryModal({ isOpen, onClose, topic }: TopicHistoryModalProps) {
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
            className="bg-[#1c1c1c] border border-white/5 shadow-2xl rounded-xl w-full max-w-3xl flex flex-col md:flex-row md:min-h-[480px] overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column */}
            <div className="w-full md:w-[280px] p-6 flex flex-col border-r border-white/5 shrink-0">
              
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] tracking-widest uppercase font-semibold text-white/30">Overview</h3>
                  <button 
                    onClick={onClose} 
                    className="p-1 text-white/40 hover:text-white transition-colors -mt-1 -mr-1"
                  >
                    <X className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="text-[12px] text-white/40 flex items-center gap-2 font-medium">
                    <Clock className="w-4 h-4 stroke-[1.5]" /> Created
                  </div>
                  <div className="text-[13px] text-white/90 font-medium ml-6">
                    {new Date(topic.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="text-[12px] text-white/40 flex items-center gap-2 font-medium">
                    <Flag className="w-4 h-4 stroke-[1.5]" /> Status
                  </div>
                  <div className="text-[13px] text-white font-medium ml-6">
                    {topic.revisions.length > 0 ? 'Active' : 'Inactive'}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="text-[12px] text-white/40 flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 stroke-[1.5]" /> Schedule Started
                  </div>
                  <div className="text-[13px] text-white/90 font-medium ml-6">
                    {(() => {
                      if (topic.revisions.length === 0) return 'Not started';
                      const startStr = topic.revisions[0].createdAt || topic.createdAt;
                      const d = startStr ? new Date(startStr) : null;
                      return d && !isNaN(d.getTime())
                        ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : 'Not started';
                    })()}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="text-[12px] text-white/40 flex items-center gap-2 font-medium">
                    <LayoutGrid className="w-4 h-4 stroke-[1.5]" /> Total Cycles
                  </div>
                  <div className="text-[13px] text-white font-medium ml-6">
                    {topic.revisions.length}
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-white/5 mb-5" />

              {nextRevision && (
                <div className="flex flex-col gap-3 mb-6">
                  <h3 className="text-[10px] tracking-widest uppercase font-semibold text-white/30">Next Revision</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[17px] font-medium text-white/90">
                      {new Date(nextRevision.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {(() => {
                      const daysDiff = getDaysDiffFromToday(new Date(nextRevision.scheduledFor));
                      if (daysDiff === 0) return <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-1 rounded-md font-medium">Today</span>;
                      if (daysDiff === 1) return <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-1 rounded-md font-medium">Tomorrow</span>;
                      if (daysDiff < 0) return <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-1 rounded-md font-medium">Overdue</span>;
                      return <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-1 rounded-md font-medium">In {daysDiff} days</span>;
                    })()}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center gap-2 text-white/90 text-[12px] font-medium">
                  <Info className="w-4 h-4 text-white/50 stroke-[1.5]" /> About Cycles
                </div>
                <p className="text-[11px] text-white/30 leading-relaxed pl-6">
                  Each cycle represents a complete revision of this topic. The next revision is scheduled based on your spaced repetition settings.
                </p>
              </div>

            </div>

            {/* Right Column */}
            <div className="flex-1 p-6 bg-[#161616] overflow-y-auto custom-scrollbar relative max-h-[75vh]">
              {/* <div className="text-white/30 mb-6 ml-2">
                <GitBranch className="w-5 h-5 transform -rotate-90 stroke-[1.5]" />
              </div> */}
              <h3 className="text-[10px] tracking-widest uppercase font-semibold text-white/30 mb-8 pl-2">Revision Timeline</h3>
              
              {topic.revisions.length === 0 ? (
                <div className="text-sm text-white/40 italic mt-4 pl-2">No revisions started yet.</div>
              ) : (
                <div className="flex flex-col relative pl-2 pb-6">
                  {topic.revisions.map((rev, idx) => {
                    const isCompleted = rev.status === 'done';
                    const isNextAction = rev.status === 'pending' && (!topic.revisions[idx - 1] || topic.revisions[idx - 1].status === 'done');
                    const isUpcoming = rev.status === 'pending' && !isNextAction;
                    
                    return (
                      <div key={rev.id} className={`flex gap-5 relative group ${isNextAction ? 'mt-4 mb-10' : 'mb-10'}`}>
                        
                        {/* Dynamic Progress Line (Connects to next node) */}
                        {idx < topic.revisions.length - 1 && (
                          <div className="absolute left-[9px] top-[24px] bottom-[-40px] w-[2px] bg-[#2a2a2a] z-0">
                            <div 
                              className="w-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-1000 rounded-b-full" 
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
                        
                        {/* Icon Container */}
                        <div className="relative shrink-0 w-[20px] h-[20px] rounded-full flex items-center justify-center bg-[#161616] z-10 mt-0.5">
                          {isCompleted && (
                            <div className="w-[20px] h-[20px] rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="w-[12px] h-[12px] text-white stroke-[2.5]" />
                            </div>
                          )}
                          {isNextAction && (
                            <div className="w-[20px] h-[20px] rounded-full border-[2px] border-blue-500 flex items-center justify-center">
                              <div className="w-[8px] h-[8px] rounded-full bg-blue-500" />
                            </div>
                          )}
                          {isUpcoming && (
                            <div className="w-[20px] h-[20px] rounded-full border-[2px] border-white/20" />
                          )}
                        </div>

                        <div className="flex flex-col flex-1 relative">
                          {isNextAction && (
                            <div className="absolute -top-[18px] left-0 text-[9px] font-bold tracking-widest text-blue-500 uppercase">
                              Next Action
                            </div>
                          )}
                          
                          {/* Title & Badge Row */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col">
                              <span className="text-[14px] font-medium text-white/90 flex items-center gap-2">
                                Cycle {rev.cycleNumber} {isUpcoming && <span className="text-white/40 text-[12px] font-normal">({rev.intervalDays} days)</span>}
                              </span>
                            </div>
                            
                            {isCompleted && (
                              <span className="bg-[#1e293b] text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded shrink-0">
                                Completed
                              </span>
                            )}
                            {isUpcoming && (
                              <span className="bg-white/5 text-white/40 text-[10px] font-semibold px-2 py-0.5 rounded shrink-0">
                                Upcoming
                              </span>
                            )}
                          </div>

                          {/* Dates Container */}
                          <div className="flex flex-col gap-1.5 mt-2">
                            <span className="text-[12px] text-white/50 flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-white/30" /> 
                              Scheduled: {new Date(rev.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            
                            {isCompleted && rev.completedAt && (
                              <span className="text-[12px] text-white/50 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-white/30" />
                                Completed: {new Date(rev.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                
                                {/* Early/Late Indicator */}
                                {(() => {
                                  const s = new Date(rev.scheduledFor);
                                  s.setHours(0,0,0,0);
                                  const c = new Date(rev.completedAt);
                                  c.setHours(0,0,0,0);
                                  const diff = Math.round((c.getTime() - s.getTime()) / 86400000);
                                  if (diff === 0) return null;
                                  if (diff < 0) return <span className="text-blue-500 ml-1">({Math.abs(diff)}d early)</span>;
                                  return <span className="text-amber-500 ml-1">({diff}d late)</span>;
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
