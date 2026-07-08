import React from 'react';

export type ResourceCategory = 'All' | 'Notes' | 'Images' | 'Links' | 'Files';

interface ResourceFilterPillsProps {
  selectedCategory: ResourceCategory;
  onCategoryChange: (category: ResourceCategory) => void;
  counts: {
    All: number;
    Notes: number;
    Images: number;
    Links: number;
    Files: number;
  };
}

export function ResourceFilterPills({ selectedCategory, onCategoryChange, counts }: ResourceFilterPillsProps) {
  const categories: ResourceCategory[] = ['All', 'Notes', 'Images', 'Links', 'Files'];

  return (
    <div className="flex items-center gap-2  overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => {
        const isSelected = selectedCategory === category;
        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`flex items-center whitespace-nowrap px-2  scale-[0.85] rounded-md text-[11px] font-medium transition-all border ${
              isSelected 
                ? 'bg-accent text-foreground border-border shadow-sm' 
                : 'bg-transparent text-muted-foreground border-transparent py-1 hover:border-border/50 hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {category} ({counts[category]})
          </button>
        );
      })}
    </div>
  );
}
