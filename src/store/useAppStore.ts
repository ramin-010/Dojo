import { create } from 'zustand';

// Basic interface matching what the sidebar needs
interface Topic {
  id: string;
  title: string;
  tags?: string[];
  sortOrder?: number | null;
  updatedAt?: Date | string;
  revisions?: any[];
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

interface AppState {
  subjects: Subject[];
  setSubjects: (subjects: Subject[]) => void;
  updateTopicTitle: (subjectId: string, topicId: string, newTitle: string) => void;
  
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  initializeSidebarState: () => void;
  
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  subjects: [],
  
  setSubjects: (subjects) => set({ subjects }),
  
  updateTopicTitle: (subjectId, topicId, newTitle) => 
    set((state) => ({
      subjects: state.subjects.map((sub) => 
        sub.id === subjectId 
          ? {
              ...sub,
              topics: sub.topics.map((t) => 
                t.id === topicId ? { ...t, title: newTitle } : t
              )
            }
          : sub
      )
    })),
    
  isSidebarCollapsed: false,
  
  setIsSidebarCollapsed: (collapsed) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('revise-sidebar-collapsed', collapsed.toString());
    }
    set({ isSidebarCollapsed: collapsed });
  },
  
  initializeSidebarState: () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('revise-sidebar-collapsed');
      if (stored) {
        set({ isSidebarCollapsed: stored === 'true' });
      }
    }
  },
  
  isSaving: false,
  setIsSaving: (saving) => set({ isSaving: saving }),
}));
