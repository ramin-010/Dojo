'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Copy, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getAiExportData } from '@/app/actions/export.actions';

interface AiContextExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function AiContextExportModal({ isOpen, onClose, workspaceId }: AiContextExportModalProps) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setGeneratedPrompt(null);
    try {
      const res = await getAiExportData(workspaceId, new Date(fromDate), new Date(toDate));
      if (res.success) {
        setGeneratedPrompt(res.data || '');
      } else {
        toast.error('Failed to generate export');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      setIsCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-sidebar border border-divider shadow-2xl rounded-2xl flex flex-col relative my-auto max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-divider/50 bg-gradient-to-r from-purple-500/10 to-transparent rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Export AI Context
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1">
                Generate a prompt with your logs and debriefs to paste into Claude or ChatGPT.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-foreground/40 hover:text-foreground hover:bg-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            {/* Date Selection */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  From Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="w-full bg-background border border-divider/40 rounded-xl pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  To Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="w-full bg-background border border-divider/40 rounded-xl pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !fromDate || !toDate}
                className="w-full sm:w-auto px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Prompt
              </button>
            </div>

            {/* Generated Output */}
            {generatedPrompt && (
              <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Generated Prompt</h3>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors rounded-lg text-xs font-semibold"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
                <div className="bg-background border border-divider/40 rounded-xl p-4 overflow-y-auto max-h-[40vh] custom-scrollbar">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {generatedPrompt}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
