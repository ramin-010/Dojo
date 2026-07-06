'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, FolderPlus, X } from 'lucide-react';
import { createSubject } from '@/app/actions/subject.actions';
import { toast } from 'sonner';

export function CreateSubjectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Subject name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      await createSubject(name.trim(), description.trim() || undefined, '#007acc'); // default color
      toast.success('Subject created successfully');
      setName('');
      setDescription('');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subject');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[101] p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-[460px] bg-background border border-divider/60 shadow-[0_32px_64px_rgba(0,0,0,0.6)] rounded-3xl pointer-events-auto overflow-hidden flex flex-col relative"
            >
              
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-sidebar/80 backdrop-blur border border-divider rounded-full text-foreground/50 hover:text-foreground hover:bg-hover transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="px-6 sm:px-8 pt-8 pb-2">
                <div className="flex items-center gap-2.5 text-foreground/90 font-medium text-lg">
                  <FolderPlus className="w-5 h-5 text-accent" />
                  Create New Subject
                </div>
              </div>

              <div className="px-6 sm:px-8 py-5 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Subject Name (e.g., System Design)"
                    className="w-full bg-sidebar border border-divider/60 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-foreground/30 shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what you'll learn here... (optional)"
                    rows={2}
                    className="w-full bg-sidebar border border-divider/60 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all resize-none placeholder:text-foreground/30 shadow-inner"
                  />
                </div>
              </div>

              <div className="px-6 sm:px-8 pb-6 pt-2 flex justify-end gap-3 bg-background">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-foreground/50 hover:text-foreground hover:bg-hover rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                  className="flex items-center gap-2 bg-accent hover:bg-[#026EC1] text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-[0_0_15px_rgba(2,110,193,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create Subject
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
