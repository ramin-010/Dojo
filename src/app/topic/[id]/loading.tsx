import { ArrowLeft, ChevronLeft, Plus } from "lucide-react";

export default function TopicLoading() {
  return (
    <div className="h-screen w-full bg-background flex overflow-hidden animate-pulse">
      {/* Main Content Area Container matching TopicWorkspace exactly */}
      <div className="flex-1 h-full overflow-y-auto overflow-x-hidden flex flex-col min-w-[500px] relative transition-all duration-300 ease-in-out">
        <div className="max-w-[960px] min-w-[960px] mx-auto w-full h-full flex flex-col px-8 transition-all duration-300 ease-in-out">
          
          <div className="pt-5 flex-shrink-0 bg-background z-30">
            {/* Top Utility Row */}
            <div className="flex items-center justify-between">
              <div className="inline-flex p-1.5 -ml-1.5">
                <ArrowLeft className="w-5 h-5 text-muted-foreground opacity-50" />
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium px-2.5 py-1">
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                  <div className="w-20 h-4 bg-white/10 rounded" />
                </div>
                <div className="w-px h-3 bg-border/50 mx-1" />
                <div className="flex items-center gap-1 text-xs font-medium px-2 py-1">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                  <div className="w-16 h-4 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 sticky top-0 bg-background z-40 transition-all duration-300 pt-8">
            <div className="flex flex-col pb-2">
              <div className="flex flex-col relative">
                {/* Absolutely positioned Tags Area */}
                <div className="absolute -top-[26px] left-0 flex items-center gap-2 z-10">
                  <div className="px-2 py-1 border border-dashed border-white/10 rounded-md">
                    <div className="w-16 h-4 bg-white/5 rounded" />
                  </div>
                  <div className="w-[25px] h-[25px] rounded-md border border-[#888888]/20" />
                </div>

                <div className="flex flex-wrap justify-between items-start gap-4 relative">
                  {/* Title Row Skeleton */}
                  <div className="w-64 h-9 bg-white/5 rounded-md mt-1" />
                  
                  {/* Revisions Button Skeleton */}
                  <div className="flex items-center gap-3 shrink-0 mt-1">
                    <div className="w-28 h-8 bg-white/5 rounded-md" />
                  </div>
                </div>
                
                {/* Date Row Skeleton */}
                <div className="flex flex-wrap items-center gap-4 text-[13px] mt-1">
                  <div className="w-32 h-3 bg-white/5 rounded-md ml-1" />
                </div>
              </div>
            </div>

            {/* Sticky Curved Border */}
            <div className="w-full border-t rounded-t-2xl h-4 mt-2 bg-background" style={{ borderColor: '#007acc' }} />
          </div>

          {/* Topic Canvas Skeleton */}
          <div className="flex-1 w-full relative transition-all duration-300">
            <div className="pb-32 w-full h-full relative">
              <div className="p-12 flex justify-center pt-2">
                <div className="w-full max-w-[800px] flex flex-col gap-4">
                  <div className="w-3/4 h-6 bg-white/5 rounded-md" />
                  <div className="w-1/2 h-6 bg-white/5 rounded-md" />
                  <div className="w-5/6 h-6 bg-white/5 rounded-md" />
                  
                  <div className="w-full h-[1px] bg-white/5 my-6" />
                  
                  <div className="w-2/3 h-6 bg-white/5 rounded-md" />
                  <div className="w-4/5 h-6 bg-white/5 rounded-md" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
