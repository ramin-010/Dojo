'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, User, Building2, Plus, Trash2, Save } from 'lucide-react';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { getWorkspaceSettings, updateWorkspaceSchedule } from '@/app/actions';

type TabId = 'workspace' | 'account';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { id: 'workspace', label: 'Workspace', icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: 'account', label: 'Account', icon: <User className="w-[18px] h-[18px]" /> },
];

export function SettingsModal() {
  const isOpen = useSettingsStore((state) => state.isOpen);
  const setIsOpen = useSettingsStore((state) => state.setIsOpen);
  const [activeTab, setActiveTab] = useState<TabId>('workspace');

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [intervals, setIntervals] = useState<number[]>([1, 3, 7, 14, 30]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getWorkspaceSettings()
        .then((settings) => {
          setWorkspaceId(settings.id);
          setIntervals(settings.spacedRepetitionIntervals);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  const handleAddInterval = () => {
    // Add the next logical interval (e.g., last + 10 or default to 60)
    const nextInterval = intervals.length > 0 ? intervals[intervals.length - 1] * 2 : 1;
    setIntervals([...intervals, nextInterval]);
  };

  const handleRemoveInterval = (index: number) => {
    if (intervals.length <= 1) return; // Must have at least 1
    const newIntervals = [...intervals];
    newIntervals.splice(index, 1);
    setIntervals(newIntervals);
  };

  const handleIntervalChange = (index: number, value: number) => {
    const newIntervals = [...intervals];
    newIntervals[index] = value;
    setIntervals(newIntervals);
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await updateWorkspaceSchedule(workspaceId, intervals);
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[900px] h-[80vh] min-h-[500px] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex"
        >
          {/* Settings Sidebar */}
          <div className="w-[240px] border-r border-border/50 bg-sidebar/50 flex flex-col pt-6 pb-4">
            <div className="px-5 mb-6 flex items-center gap-2 text-foreground font-semibold">
              <Settings className="w-5 h-5" />
              Settings
            </div>

            <nav className="flex-1 px-3 space-y-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="settings-active-bg"
                        className="absolute inset-0 bg-accent/10 rounded-lg"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="settings-active-line"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-primary"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{tab.icon}</span>
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-background flex flex-col">
            <div className="h-14 flex items-center justify-between px-8 border-b border-border/50 shrink-0">
              <h2 className="text-sm font-semibold text-foreground">
                {tabs.find((t) => t.id === activeTab)?.label} Settings
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {activeTab === 'workspace' && (
                <div className="max-w-xl">
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-foreground mb-1">Spaced Repetition Schedule</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure the default review intervals (in days) for topics in your workspace.
                    </p>
                  </div>

                  {isLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-10 bg-muted/50 rounded-lg w-full" />
                      <div className="h-10 bg-muted/50 rounded-lg w-full" />
                      <div className="h-10 bg-muted/50 rounded-lg w-full" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        {intervals.map((interval, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2 w-full max-w-[300px]">
                              <span className="text-xs font-semibold text-muted-foreground w-16">
                                Cycle {idx + 1}
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={interval}
                                onChange={(e) => handleIntervalChange(idx, parseInt(e.target.value) || 1)}
                                className="bg-transparent outline-none w-full text-sm font-medium text-foreground text-right"
                              />
                              <span className="text-sm text-muted-foreground">days</span>
                            </div>
                            
                            <button
                              onClick={() => handleRemoveInterval(idx)}
                              disabled={intervals.length <= 1}
                              className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleAddInterval}
                        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add Review Cycle
                      </button>

                      <div className="pt-6 border-t border-border/50">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {isSaving ? 'Saving...' : 'Save Schedule'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'account' && (
                <div className="max-w-xl">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Account Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Account management is not yet available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
