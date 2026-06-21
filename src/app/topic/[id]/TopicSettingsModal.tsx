import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Trash2, Edit2, AlertCircle } from 'lucide-react';

interface TopicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
}

export function TopicSettingsModal({ isOpen, onClose, topicId }: TopicSettingsModalProps) {
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
                  <h3 className="text-[10px] tracking-widest uppercase font-semibold text-white/30">Settings</h3>
                  <button 
                    onClick={onClose} 
                    className="p-1 text-white/40 hover:text-white transition-colors -mt-1 -mr-1"
                  >
                    <X className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="text-[12px] text-white/40 flex items-center gap-2 font-medium">
                    <Settings className="w-4 h-4 stroke-[1.5]" /> Configuration
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-white/5 mb-5" />

              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center gap-2 text-white/90 text-[12px] font-medium">
                  <AlertCircle className="w-4 h-4 text-white/50 stroke-[1.5]" /> Danger Zone
                </div>
                <p className="text-[11px] text-white/30 leading-relaxed pl-6">
                  Proceed with caution. Deleted topics cannot be recovered, and all their associated data will be permanently removed.
                </p>
              </div>

            </div>

            {/* Right Column */}
            <div className="flex-1 p-6 bg-[#161616] overflow-y-auto custom-scrollbar relative max-h-[75vh]">
              <h3 className="text-[10px] tracking-widest uppercase font-semibold text-white/30 mb-8 pl-2">Topic Actions</h3>
              
              <div className="flex flex-col gap-4 pl-2">
                {/* Rename Topic Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-[#1c1c1c] group hover:border-white/10 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="text-[14px] font-medium text-white/90 flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                      Rename Topic
                    </span>
                    <span className="text-[12px] text-white/40">
                      Change the title of this topic.
                    </span>
                  </div>
                  <button className="bg-white/5 hover:bg-white/10 text-white/90 text-[12px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0">
                    Rename
                  </button>
                </div>

                {/* Delete Topic Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-500/10 bg-red-500/5 group hover:border-red-500/20 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="text-[14px] font-medium text-red-500/90 flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-500/50 group-hover:text-red-500/70 transition-colors" />
                      Delete Topic
                    </span>
                    <span className="text-[12px] text-red-500/50">
                      Permanently delete this topic and all of its content.
                    </span>
                  </div>
                  <button className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[12px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0">
                    Delete
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
