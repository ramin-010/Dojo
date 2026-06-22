import React from 'react';
import { FileText } from 'lucide-react';

interface ResourceFooterProps {
  totalCount: number;
}

export function ResourceFooter({ totalCount }: ResourceFooterProps) {
  return (
    <div className="mt-auto pt-4 border-t border-zinc-800 flex items-center justify-between pb-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="w-4 h-4" />
        <span className="text-sm">{totalCount} resources total</span>
      </div>
      <button className="text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors">
        Manage resources
      </button>
    </div>
  );
}
