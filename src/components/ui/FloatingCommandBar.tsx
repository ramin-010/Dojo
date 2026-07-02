import React from 'react';
import { Plus, Mic, AudioLines } from 'lucide-react';

export function FloatingCommandBar() {
  return (
    <div className="sticky bottom-8 mt-auto pt-12 w-full flex justify-center z-50 pointer-events-none">
      <div className="w-full max-w-[700px] bg-sidebar/80 backdrop-blur-md border border-divider rounded-full p-2 pl-4 flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.4)] pointer-events-auto">
        <button className="p-1.5 text-foreground/40 hover:text-foreground transition-colors rounded-full hover:bg-hover">
          <Plus className="w-5 h-5" />
        </button>
        <input
          type="text"
          placeholder="Ask anything..."
          className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-foreground/30 text-foreground"
        />
        <div className="flex items-center gap-1 pr-1">
          <button className="p-2 text-foreground/40 hover:text-foreground transition-colors rounded-full hover:bg-hover">
            <Mic className="w-4 h-4" />
          </button>
          <button className="p-2 bg-foreground text-background hover:bg-foreground/90 transition-colors rounded-full flex items-center justify-center">
            <AudioLines className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
