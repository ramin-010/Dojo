'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, FolderPlus, X } from 'lucide-react';
import { createSubject } from '@/app/actions/subject.actions';
import { toast } from 'sonner';

export function CreateSubjectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#007acc');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Subject name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      await createSubject(name.trim(), description.trim() || undefined, color);
      toast.success('Subject created successfully');
      setName('');
      setDescription('');
      setColor('#007acc');
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
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[101]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-[420px] bg-[#121212]/90 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-[24px] pointer-events-auto overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <div className="flex items-center gap-2.5 text-foreground/90 font-medium">
                  <div className="p-1.5 bg-accent/10 rounded-md">
                    <FolderPlus className="w-4 h-4 text-accent" />
                  </div>
                  New Subject
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-foreground/40 hover:text-foreground hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-4 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-foreground/50 uppercase tracking-widest ml-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., System Design"
                    className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-foreground/30"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-foreground/50 uppercase tracking-widest ml-1">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description..."
                    rows={3}
                    className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all resize-none placeholder:text-foreground/30"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-foreground/50 uppercase tracking-widest ml-1">Theme Color</label>
                  <div className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-lg p-2 w-max">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full"
                    />
                    <span className="text-sm font-mono text-foreground/40">{color}</span>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2 flex justify-end gap-3 mt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-foreground/50 hover:text-foreground hover:bg-white/5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                  className="flex items-center gap-2 bg-accent hover:bg-[#026EC1] text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
