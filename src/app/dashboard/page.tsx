import { CheckCircle2, Circle, Clock } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="p-8 max-w-5xl mx-auto w-full h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold mb-2 text-foreground">Today's Revisions</h1>
        <p className="text-foreground/60 text-sm">You have 3 topics scheduled for review today.</p>
      </header>

      <div className="grid gap-4 flex-1 content-start">
        {/* Mock Topic Card 1 */}
        <Link href="/topic/1" className="group relative bg-sidebar border rounded-lg p-5 hover:bg-hover transition-colors cursor-pointer flex gap-4 items-start block">
          <button className="mt-1 text-foreground/40 hover:text-accent transition-colors">
            <Circle className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-[14px]">React Server Components Deep Dive</h3>
              <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Day 1
              </span>
            </div>
            <p className="text-sm text-foreground/60 mb-3">
              Reviewing the lifecycle differences between Server and Client components, specifically regarding hydration.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-background rounded text-foreground/70 border border-divider">
                Next.js Architecture
              </span>
            </div>
          </div>
        </Link>

        {/* Mock Topic Card 2 */}
        <div className="group relative bg-sidebar border rounded-lg p-5 hover:bg-hover transition-colors cursor-pointer flex gap-4 items-start">
          <button className="mt-1 text-foreground/40 hover:text-accent transition-colors">
            <Circle className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-[14px]">PostgreSQL Indexing Strategies</h3>
              <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Day 3
              </span>
            </div>
            <p className="text-sm text-foreground/60 mb-3">
              B-Tree vs Hash indexes, and when to use partial indexes for performance.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-background rounded text-foreground/70 border border-divider">
                Database Optimization
              </span>
            </div>
          </div>
        </div>

        {/* Mock Topic Card 3 (Missed / Overdue) */}
        <div className="group relative bg-sidebar border border-[#f48771]/30 rounded-lg p-5 hover:bg-hover transition-colors cursor-pointer flex gap-4 items-start">
          <button className="mt-1 text-[#f48771] hover:text-[#f48771]/80 transition-colors">
            <Circle className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-[14px] text-[#f48771]">Docker Networking Basics</h3>
              <span className="text-xs font-medium text-[#f48771] uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Overdue (Day 7)
              </span>
            </div>
            <p className="text-sm text-foreground/60 mb-3">
              Bridge networks, host networks, and docker-compose networking isolated environments.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-background rounded text-foreground/70 border border-divider">
                DevOps
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
