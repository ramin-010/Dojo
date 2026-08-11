import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Trash2, Edit2,Columns,Maximize, AlertCircle, FolderInput, FileText, Copy, Archive, ArchiveRestore, Palette, Type, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { exportTopicAsMarkdown } from '@/lib/utils/export';
import { moveTopicToSubject, duplicateTopic, archiveTopic, unarchiveTopic, deleteTopic } from '@/app/actions/topic.actions';
import { toast } from 'sonner';

interface TopicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: any;
}

export function TopicSettingsModal({ isOpen, onClose, topic }: TopicSettingsModalProps) {
  const router = useRouter();
  const { subjects, typography, setTypography, topicTheme, setTopicTheme } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'configuration' | 'appearance'>('configuration');
  const [selectedSubjectId, setSelectedSubjectId] = useState(topic?.subjectId || '');
  const [isMoving, setIsMoving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleMove = async () => {
    if (!selectedSubjectId || selectedSubjectId === topic.subjectId) return;
    try {
      setIsMoving(true);
      await moveTopicToSubject(topic.id, selectedSubjectId);
      toast.success('Topic moved successfully');
      onClose();
    } catch (e) {
      toast.error('Failed to move topic');
    } finally {
      setIsMoving(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setIsDuplicating(true);
      const newTopicId = await duplicateTopic(topic.id);
      toast.success('Topic duplicated');
      onClose();
      router.push(`/topic/${newTopicId}`);
    } catch (e) {
      toast.error('Failed to duplicate topic');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleToggleArchive = async () => {
    try {
      setIsArchiving(true);
      if (topic.isArchived) {
        await unarchiveTopic(topic.id);
        toast.success('Topic unarchived');
      } else {
        await archiveTopic(topic.id);
        toast.success('Topic archived');
        router.push(`/subject/${topic.subjectId}`);
      }
      onClose();
    } catch (e) {
      toast.error('Failed to update archive status');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleExportMarkdown = () => {
    try {
      const blocks = topic.canvasData?.blocks || [];
      exportTopicAsMarkdown(topic.title, blocks);
      toast.success('Export started');
    } catch (e) {
      toast.error('Failed to export markdown');
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    try {
      setIsDeleting(true);
      await deleteTopic(topic.id);
      toast.success('Topic permanently deleted');
      onClose();
      router.push(`/subject/${topic.subjectId}`);
    } catch (e) {
      toast.error('Failed to delete topic');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" 
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-3xl flex flex-col md:flex-row md:min-h-[480px] overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column */}
            <div className="w-full md:w-[240px] p-4 flex flex-col border-r border-border shrink-0 bg-background/50">
              
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted pl-2">Settings</h3>
                  <button 
                    onClick={onClose} 
                    className="p-1 text-muted hover:text-foreground transition-colors -mt-1 -mr-1"
                  >
                    <X className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    onClick={() => setActiveTab('configuration')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      activeTab === 'configuration' 
                        ? 'bg-foreground/10 text-foreground' 
                        : 'text-muted hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <Settings className="w-4 h-4 stroke-[1.5]" /> Configuration
                  </button>
                  <button
                    onClick={() => setActiveTab('appearance')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      activeTab === 'appearance' 
                        ? 'bg-foreground/10 text-foreground' 
                        : 'text-muted hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <Palette className="w-4 h-4 stroke-[1.5]" /> Appearance
                  </button>
                </div>
              </div>

              {activeTab === 'configuration' && (
                <>
                  <div className="w-full h-px bg-border mb-5 mt-auto" />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-foreground text-[12px] font-medium pl-2">
                      <AlertCircle className="w-4 h-4 text-muted stroke-[1.5]" /> Danger Zone
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed pl-8">
                      Deleted topics cannot be recovered. All associated data will be removed.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Right Column */}
            <div className="flex-1 p-6 bg-background overflow-y-auto custom-scrollbar relative max-h-[75vh]">
              
              {activeTab === 'configuration' ? (
                <>
                  <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted mb-8 pl-2">Topic Actions</h3>
                  <div className="flex flex-col gap-4 pl-2">
                    
                    {/* Move to Subject */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background/50 group hover:border-border/80 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          <FolderInput className="w-4 h-4 text-muted group-hover:text-foreground/60 transition-colors" />
                          Move to Subject
                        </span>
                        <span className="text-[12px] text-muted">
                          Re-assign this topic to another subject.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          value={selectedSubjectId} 
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          className="bg-background border border-border text-foreground/80 text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-border/80"
                        >
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={handleMove}
                          disabled={isMoving || selectedSubjectId === topic.subjectId}
                          className="bg-foreground/5 hover:bg-foreground/10 disabled:opacity-50 text-foreground text-[12px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
                        >
                          {isMoving ? 'Moving...' : 'Move'}
                        </button>
                      </div>
                    </div>

                    {/* Export as Markdown */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background/50 group hover:border-border/80 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted group-hover:text-foreground/60 transition-colors" />
                          Export as Markdown
                        </span>
                        <span className="text-[12px] text-muted">
                          Download a pure markdown copy of your notes.
                        </span>
                      </div>
                      <button 
                        onClick={handleExportMarkdown}
                        className="bg-foreground/5 hover:bg-foreground/10 text-foreground text-[12px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
                      >
                        Export
                      </button>
                    </div>

                    {/* Duplicate Topic */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background/50 group hover:border-border/80 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          <Copy className="w-4 h-4 text-muted group-hover:text-foreground/60 transition-colors" />
                          Duplicate Topic
                        </span>
                        <span className="text-[12px] text-muted">
                          Create an exact copy in the same subject.
                        </span>
                      </div>
                      <button 
                        onClick={handleDuplicate}
                        disabled={isDuplicating}
                        className="bg-foreground/5 hover:bg-foreground/10 disabled:opacity-50 text-foreground text-[12px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
                      >
                        {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                      </button>
                    </div>

                    {/* Archive Topic */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background/50 group hover:border-border/80 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          {topic.isArchived ? (
                            <ArchiveRestore className="w-4 h-4 text-muted group-hover:text-foreground/60 transition-colors" />
                          ) : (
                            <Archive className="w-4 h-4 text-muted group-hover:text-foreground/60 transition-colors" />
                          )}
                          {topic.isArchived ? 'Unarchive Topic' : 'Archive Topic'}
                        </span>
                        <span className="text-[12px] text-muted">
                          {topic.isArchived 
                            ? 'Restore this topic back to active view.'
                            : 'Hide from active view without deleting.'}
                        </span>
                      </div>
                      <button 
                        onClick={handleToggleArchive}
                        disabled={isArchiving}
                        className="bg-foreground/5 hover:bg-foreground/10 disabled:opacity-50 text-foreground text-[12px] font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
                      >
                        {isArchiving ? 'Saving...' : (topic.isArchived ? 'Unarchive' : 'Archive')}
                      </button>
                    </div>

                    <div className="w-full h-px bg-border my-2" />

                    {/* Delete Topic */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-500/10 bg-red-500/5 group hover:border-red-500/20 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-medium text-red-400 flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-red-500/50 group-hover:text-red-400 transition-colors" />
                          Delete Topic
                        </span>
                        <span className="text-[12px] text-red-400/60">
                          {showDeleteConfirm ? 'Are you absolutely sure?' : 'Permanently remove this topic.'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {showDeleteConfirm && (
                          <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[12px] font-medium px-4 py-2 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        <button 
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-50 text-[12px] font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {isDeleting ? 'Deleting...' : (showDeleteConfirm ? 'Yes, delete it' : 'Delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-8 pl-2 max-w-xl">
                    <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted">Reading Preferences</h3>
                    <button 
                      onClick={() => setTypography({ fontSize: 14, lineHeight: 1.5, headingSpacing: 'standard', layoutWidth: 960, canvasWidth: 890 })}
                      className="text-[11px] text-muted hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  </div>
                  <div className="flex flex-col gap-8 pl-2 max-w-xl">
                    
                    {/* Theme Selector */}
                    <div className="flex flex-col gap-3">
                      <label className="text-[14px] font-medium text-foreground flex items-center gap-2 mb-1">
                        <Palette className="w-4 h-4 text-muted" />
                        Theme
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'default', label: 'Default', bg: 'bg-[#191919]', accent: 'bg-[#007acc]' },
                          { id: 'catppuccin-latte', label: 'Catppuccin', bg: 'bg-[#eff1f5]', accent: 'bg-[#8839ef]' },
                          { id: 'light', label: 'Light', bg: 'bg-[#f7f5f0]', accent: 'bg-[#3a5a7d]' },
                          { id: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]', accent: 'bg-[#a8672c]' },
                          { id: 'gruvbox-light', label: 'Gruvbox', bg: 'bg-[#ebdbb2]', accent: 'bg-[#d65d0e]' },
                          { id: 'rose-pine-dawn', label: 'Rosé Pine', bg: 'bg-[#faf4ed]', accent: 'bg-[#b4637a]' }
                        ].map(theme => (
                          <button
                            key={theme.id}
                            onClick={() => setTopicTheme(theme.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              topicTheme === theme.id 
                                ? 'border-accent/40 bg-accent/10' 
                                : 'border-border/50 bg-background/50 hover:bg-foreground/5'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full ${theme.bg} ring-2 ring-offset-2 ring-offset-transparent ${
                              topicTheme === theme.id ? 'ring-accent/50' : 'ring-transparent'
                            } flex items-center justify-center overflow-hidden relative shadow-sm`}>
                              <div className={`absolute right-0 bottom-0 w-2 h-2 ${theme.accent}`} />
                            </div>
                            <span className="text-[12px] font-medium text-foreground">{theme.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Font Size */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          <Type className="w-4 h-4 text-muted" />
                          Base Font Size
                        </label>
                        <span className="text-[12px] text-muted font-mono">{typography.fontSize}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="13" 
                        max="22" 
                        step="0.5"
                        value={typography.fontSize}
                        onChange={(e) => setTypography({ fontSize: Number(e.target.value) })}
                        className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-foreground"
                      />
                      <div className="flex justify-between text-[11px] text-muted px-1">
                        <span>A</span>
                        <span className="text-[14px]">A</span>
                      </div>
                    </div>

                    {/* Line Height */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          <div className="flex flex-col gap-0.5 items-center justify-center w-4 h-4 text-muted">
                            <div className="w-3 h-px bg-current"></div>
                            <div className="w-3 h-px bg-current"></div>
                            <div className="w-3 h-px bg-current"></div>
                          </div>
                          Line Height
                        </label>
                        <span className="text-[12px] text-muted font-mono">{typography.lineHeight}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1.4" 
                        max="2.0" 
                        step="0.05"
                        value={typography.lineHeight}
                        onChange={(e) => setTypography({ lineHeight: Number(e.target.value) })}
                        className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-foreground"
                      />
                      <div className="flex justify-between text-[11px] text-muted px-1">
                        <span>Tight</span>
                        <span>Relaxed</span>
                      </div>
                    </div>

                    {/* Heading Spacing */}
                    <div className="flex flex-col gap-3">
                      <label className="text-[14px] font-medium text-foreground flex items-center gap-2 mb-1">
                        Heading Spacing
                      </label>
                      <div className="flex p-1 bg-background rounded-xl border border-border">
                        {[
                          { id: 'compact', label: 'Compact' },
                          { id: 'standard', label: 'Standard' },
                          { id: 'relaxed', label: 'Relaxed' }
                        ].map(option => (
                          <button
                            key={option.id}
                            onClick={() => setTypography({ headingSpacing: option.id as any })}
                            className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                              typography.headingSpacing === option.id 
                                ? 'bg-card text-foreground shadow-sm border border-border/50' 
                                : 'text-muted hover:text-foreground hover:bg-foreground/5'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted px-1">
                        Adjusts the margin above headings to visually group paragraphs.
                      </p>
                    </div>

                    {/* Workspace Width */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[14px] font-medium text-foreground flex items-center gap-2">
                          <Columns className="w-4 h-4 text-muted" />
                          Workspace Width
                        </label>
                        <span className="text-[12px] text-muted font-mono">{typography.layoutWidth ?? 960}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="960" 
                        max="1600" 
                        step="10"
                        value={typography.layoutWidth ?? 960}
                        onChange={(e) => {
                          const newLayout = Number(e.target.value);
                          const newCanvas = newLayout - 70;
                          setTypography({ layoutWidth: newLayout, canvasWidth: newCanvas });
                        }}
                        className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-foreground"
                      />
                      <div className="flex justify-between text-[11px] text-muted px-1">
                        <span>Compact</span>
                        <span>Wide</span>
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
