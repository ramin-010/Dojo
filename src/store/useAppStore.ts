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

interface TypographySettings {
  fontSize: number;
  lineHeight: number;
  headingSpacing: 'compact' | 'standard' | 'relaxed';
  layoutWidth: number;
  canvasWidth: number;
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
  
  isSplitViewActive: boolean;
  setIsSplitViewActive: (active: boolean) => void;

  typography: TypographySettings;
  setTypography: (settings: Partial<TypographySettings>) => void;
  initializeTypographyState: () => void;

  revisionQueue: Topic[] | null;
  setRevisionQueue: (queue: Topic[] | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
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
  
  isSplitViewActive: false,
  setIsSplitViewActive: (active) => set({ isSplitViewActive: active }),

  typography: {
    fontSize: 14,
    lineHeight: 1.5,
    headingSpacing: 'standard',
    layoutWidth: 960,
    canvasWidth: 890
  },
  
  setTypography: (newSettings) => set((state) => {
    const updated = { ...state.typography, ...newSettings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('revise-typography', JSON.stringify(updated));
      // Immediately apply to document body for reactive CSS updates
      document.documentElement.style.setProperty('--dynamic-font-size', `${updated.fontSize}px`);
      document.documentElement.style.setProperty('--dynamic-line-height', `${updated.lineHeight}`);
      
      const hsMap = {
        compact: '1.2rem',
        standard: '1.6rem',
        relaxed: '2.2rem'
      };
      document.documentElement.style.setProperty('--dynamic-heading-spacing', hsMap[updated.headingSpacing]);
    }
    return { typography: updated };
  }),
  
  initializeTypographyState: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('revise-typography');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          set({ typography: { 
            ...get().typography, 
            ...parsed,
            layoutWidth: parsed.layoutWidth ?? 960,
            canvasWidth: parsed.canvasWidth ?? 890
          } });
          document.documentElement.style.setProperty('--dynamic-font-size', `${parsed.fontSize}px`);
          document.documentElement.style.setProperty('--dynamic-line-height', `${parsed.lineHeight}`);
          const hsMap = { compact: '1.2rem', standard: '1.6rem', relaxed: '2.2rem' };
          document.documentElement.style.setProperty('--dynamic-heading-spacing', hsMap[parsed.headingSpacing as keyof typeof hsMap] || '1.6rem');
        } catch(e) {
          console.error('Failed to parse typography settings', e);
        }
      }
    }
  },

  revisionQueue: null,
  setRevisionQueue: (queue) => set({ revisionQueue: queue }),
}));
