import { CheckCircle2, Circle, CalendarIcon } from 'lucide-react';
import React from 'react';

export function TaskActionMenu({ 
  task, 
  isOpen, 
  onToggle, 
  onReschedule, 
  onOpen,
  onClose,
  circleColorClass,
  hoverColorClass,
  sizeClass = "w-4 h-4",
  labels = { complete: "Complete", reschedule: "Reschedule", delete: "Delete", edit: "Edit" },
  onDelete,
  onEdit
}: { 
  task: any, 
  isOpen: boolean,
  onToggle: () => void,
  onReschedule: () => void,
  onOpen: (e: React.MouseEvent) => void,
  onClose: () => void,
  circleColorClass: string,
  hoverColorClass: string,
  sizeClass?: string,
  labels?: { complete: string, reschedule: string, delete?: string, edit?: string },
  onDelete?: () => void,
  onEdit?: () => void
}) {
  return (
    <div className="shrink-0 relative h-5 flex items-center justify-center z-10 ml-2">
      {task.status === 'done' || task.isDone ? (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <CheckCircle2 className={`${sizeClass} text-emerald-500/60 hover:text-emerald-500 transition-colors`} />
        </button>
      ) : (
        <>
          <button onClick={onOpen} className={`${sizeClass} group/btn flex items-center justify-center`}>
            <Circle className={`${sizeClass} transition-colors ${circleColorClass} ${hoverColorClass}`} />
          </button>
          
          {isOpen && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); onClose(); }} />
              <div className="absolute top-6 left-0 z-[9999] bg-sidebar border border-divider rounded-xl p-1 shadow-[0_16px_40px_rgba(0,0,0,0.25)] min-w-[150px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggle(); onClose(); }}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-hover rounded-lg transition-colors w-full text-left group/item"
                >
                  <CheckCircle2 className="w-[15px] h-[15px] text-emerald-500/80 group-hover/item:text-emerald-500" />
                  <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">{labels.complete}</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onReschedule(); onClose(); }}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-hover rounded-lg transition-colors w-full text-left group/item"
                >
                  <CalendarIcon className="w-[15px] h-[15px] text-accent/80 group-hover/item:text-accent" />
                  <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">{labels.reschedule}</span>
                </button>
                {onEdit && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); onClose(); }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-hover rounded-lg transition-colors w-full text-left group/item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60 group-hover/item:text-foreground"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">{labels.edit || "Edit"}</span>
                  </button>
                )}
                {onDelete && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left group/item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500/80 group-hover/item:text-red-500"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    <span className="text-[13px] font-medium text-red-500/90 group-hover/item:text-red-500">{labels.delete || "Delete"}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
