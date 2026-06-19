'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutDashboard, BookOpen, Settings } from 'lucide-react';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={`${isCollapsed ? 'w-16' : 'w-64'} bg-sidebar border-r flex flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative z-50`}
    >
      <div className={`flex items-center h-14 border-b border-border ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!isCollapsed && <span className="font-semibold text-sm whitespace-nowrap">Revise</span>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-hover text-muted-foreground transition-colors flex-shrink-0"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1 overflow-x-hidden">
        <Link 
          href="/dashboard" 
          className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-hover text-sm text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? "Dashboard" : undefined}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Dashboard</span>}
        </Link>
        
        {!isCollapsed ? (
          <div className="mt-6 mb-2 px-3 text-[10px] uppercase text-foreground/40 font-semibold tracking-wider">
            Subjects
          </div>
        ) : (
          <div className="mt-6 mb-2 flex justify-center">
            <div className="h-px w-6 bg-divider" />
          </div>
        )}

        <Link 
          href="/subject/1" 
          className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-hover text-sm text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? "TypeScript Prep" : undefined}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap truncate">TypeScript Prep</span>}
        </Link>
      </nav>

      <div className="p-2 border-t border-border">
        <button 
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-hover text-sm text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
