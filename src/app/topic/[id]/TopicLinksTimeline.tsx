import { MoreHorizontal } from 'lucide-react';

export type ContextLink = {
  id: string;
  path: string;
  taggedAt: string;
  updatedAt: string;
};

type ContextLinksData = {
  outbound: ContextLink[];
  inbound: ContextLink[];
};

export function TopicLinksTimeline({ contextLinks, onMentionClick }: { contextLinks: ContextLinksData; onMentionClick: (id: string) => void }) {
  return (
    <div className="pb-4 pt-2">
      <div className="space-y-8">
        {/* LINKED TO (OUTBOUND) */}
        {contextLinks.outbound.length > 0 && (
          <div className="relative flex flex-col">
            {/* Single continuous trunk line for entire section */}
            <div style={{ position: 'absolute', left: 24, top: 10, bottom: 40, width: 2, background: '#525252', borderRadius: 1 }} />
            
            <div className="pl-[48px] mb-1 py-1">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Linked To (Outbound)
              </h4>
            </div>
            
            <div className="flex flex-col">
              {contextLinks.outbound.map((link, i) => (
                <div key={link.id} className="relative group cursor-pointer hover:bg-white/[0.03] py-3.5 pr-5 pl-[48px] transition-colors" onClick={() => onMentionClick(link.id)}>
                  {/* Horizontal curve branching off the trunk */}
                  <svg style={{ position: 'absolute', left: 25, top: 14 }} width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <path d="M0 0 Q0 9 9 9 L18 9" stroke="#525252" strokeWidth="2" fill="none" />
                  </svg>
                  
                  {/* Dot at end of branch */}
                  <div className="absolute top-[20px] w-[7px] h-[7px] rounded-full bg-blue-500 ring-[3px] ring-background group-hover:ring-zinc-950 transition-colors z-10" style={{ left: 41 }} />

                  <div className="flex-1 flex flex-col gap-1 ml-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-[13px] text-foreground/90 group-hover:text-foreground transition-colors tracking-tight">
                        {link.path}
                      </div>
                      <button className="text-muted-foreground/30 hover:text-foreground transition-colors mt-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground/40 font-medium tracking-wide mt-0.5">
                      Tagged {link.taggedAt} <span className="mx-1.5 opacity-30">•</span> Updated {link.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REFERENCED BY (INBOUND) */}
        {contextLinks.inbound.length > 0 && (
          <div className="relative flex flex-col">
            {/* Single continuous trunk line for entire section */}
            <div style={{ position: 'absolute', left: 24, top: 10, bottom: 40, width: 2, background: '#525252', borderRadius: 1 }} />
            
            <div className="pl-[48px] mb-1 py-1">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Referenced By (Inbound)
              </h4>
            </div>
            
            <div className="flex flex-col">
              {contextLinks.inbound.map((link, i) => (
                <div key={link.id} className="relative group cursor-pointer hover:bg-white/[0.03] py-3.5 pr-5 pl-[48px] transition-colors" onClick={() => onMentionClick(link.id)}>
                  {/* Horizontal curve branching off the trunk */}
                  <svg style={{ position: 'absolute', left: 25, top: 14 }} width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <path d="M0 0 Q0 9 9 9 L18 9" stroke="#525252" strokeWidth="2" fill="none" />
                  </svg>
                  
                  {/* Dot at end of branch */}
                  <div className="absolute top-[20px] w-[7px] h-[7px] rounded-full bg-blue-500 ring-[3px] ring-background group-hover:ring-zinc-950 transition-colors z-10" style={{ left: 41 }} />

                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-[13px] text-foreground/90 group-hover:text-foreground transition-colors tracking-tight">
                        {link.path}
                      </div>
                      <button className="text-muted-foreground/30 hover:text-foreground transition-colors mt-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground/40 font-medium tracking-wide mt-0.5">
                      Tagged {link.taggedAt} <span className="mx-1.5 opacity-30">•</span> Updated {link.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
