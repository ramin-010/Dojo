import { create } from 'zustand';

interface SettingsState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
}));
