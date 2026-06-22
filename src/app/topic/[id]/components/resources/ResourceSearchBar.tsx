import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

interface ResourceSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ResourceSearchBar({ searchQuery, onSearchChange }: ResourceSearchBarProps) {
  return (
    <div className="flex items-center mb-3">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search resources..."
          className="block w-full pl-8 pr-3 py-1.5 bg-black/20 border border-white/5 rounded-lg text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
        />
      </div>
    </div>
  );
}
