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
  labels = { complete: "Complete", reschedule: "Reschedule" }
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
  labels?: { complete: string, reschedule: string }
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
              <div className="absolute top-6 left-0 z-[9999] bg-black border border-white/20 rounded-xl p-1 shadow-[0_16px_40px_rgba(0,0,0,1)] min-w-[150px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggle(); onClose(); }}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors w-full text-left group/item"
                >
                  <CheckCircle2 className="w-[15px] h-[15px] text-emerald-500/80 group-hover/item:text-emerald-500" />
                  <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">{labels.complete}</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onReschedule(); onClose(); }}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors w-full text-left group/item"
                >
                  <CalendarIcon className="w-[15px] h-[15px] text-accent/80 group-hover/item:text-accent" />
                  <span className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground">{labels.reschedule}</span>
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
