import { 
  BookOpen, 
  Plus, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Clock, 
  Link as LinkIcon, 
  Pin,
  Edit3,
  Circle,
  CheckCircle2,
  Lock
} from "lucide-react";
import Link from "next/link";

export default function SubjectPage({ params }: { params: { id: string } }) {
  // Mock data for "TypeScript Prep"
  const subjectName = "TypeScript Prep";

  return (
    <div className="p-8 max-w-5xl mx-auto w-full h-full flex flex-col space-y-8">
      
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-accent" />
            {subjectName}
          </h1>
          <p className="text-foreground/60 text-sm">
            12 topics · 3 due for revision · Last active: 2h ago
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-accent hover:bg-[#026EC1] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            New Topic
          </button>
          <button className="p-2 border border-divider rounded-md hover:bg-hover text-foreground/70 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="h-[1px] w-full bg-divider" />

      {/* CONTINUE WHERE YOU LEFT OFF */}
      <section>
        <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
          <ChevronDown className="w-4 h-4" /> CONTINUE WHERE YOU LEFT OFF
        </h2>
        <div className="bg-sidebar border border-divider rounded-lg p-5 flex flex-col gap-3 group hover:border-accent/50 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-accent" /> Generics in TS
            </h3>
            <span className="text-xs text-foreground/40">Last edited: 2 hours ago</span>
          </div>
          <p className="text-sm text-foreground/70 italic">
            "...mapped types allow you to create new types based on existing ones by iterating..."
          </p>
          <div className="flex justify-end">
            <Link href="/topic/1" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              Continue Writing <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* REVISIONS DUE */}
      <section>
        <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
          <ChevronDown className="w-4 h-4" /> REVISIONS DUE (for this subject only)
        </h2>
        <div className="flex flex-col gap-2">
          <Link href="/topic/1" className="group bg-sidebar border border-divider rounded-lg p-4 hover:bg-hover transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Circle className="w-5 h-5 text-foreground/30 group-hover:text-accent transition-colors" />
              <span className="font-medium">Generics in TS</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-foreground/50">Day 3</span>
              <span className="text-accent font-medium">Tomorrow</span>
            </div>
          </Link>
          <Link href="/topic/2" className="group bg-sidebar border border-divider rounded-lg p-4 hover:bg-hover transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Circle className="w-5 h-5 text-foreground/30 group-hover:text-accent transition-colors" />
              <span className="font-medium">Type Guards</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-foreground/50">Day 7</span>
              <span className="text-accent font-medium">In 3 days</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ALL TOPICS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-foreground">
            <ChevronDown className="w-4 h-4" /> ALL TOPICS
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Search topics..." 
              className="bg-sidebar border border-divider rounded-md pl-9 pr-3 py-1.5 text-sm w-64 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="bg-sidebar border border-divider rounded-lg overflow-hidden">
          <div className="divide-y divide-divider">
            {/* Topic 1 */}
            <div className="p-3 hover:bg-hover flex items-center justify-between transition-colors cursor-pointer group">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">Generics in TS</span>
              </div>
              <div className="flex items-center gap-4 w-[300px] justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-background rounded-full overflow-hidden flex">
                    <div className="w-3/4 h-full bg-accent" />
                  </div>
                  <span className="text-xs text-foreground/50 w-6">3/4</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">#core</span>
                <span className="text-xs text-foreground/40 w-12 text-right">2h ago</span>
              </div>
            </div>

            {/* Topic 2 */}
            <div className="p-3 hover:bg-hover flex items-center justify-between transition-colors cursor-pointer group">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">Utility Types</span>
              </div>
              <div className="flex items-center gap-4 w-[300px] justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-background rounded-full overflow-hidden flex">
                    <div className="w-2/4 h-full bg-accent" />
                  </div>
                  <span className="text-xs text-foreground/50 w-6">2/4</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">#core</span>
                <span className="text-xs text-foreground/40 w-12 text-right">1d ago</span>
              </div>
            </div>

            {/* Topic 3 - Locked */}
            <div className="p-3 hover:bg-hover flex items-center justify-between transition-colors cursor-pointer group opacity-70">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">Enums</span>
              </div>
              <div className="flex items-center gap-4 w-[300px] justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-background rounded-full overflow-hidden flex">
                    <div className="w-full h-full bg-green-500" />
                  </div>
                  <span className="text-xs text-foreground/50 w-6">4/4</span>
                </div>
                <Lock className="w-3 h-3 text-green-500" />
                <span className="text-xs text-foreground/40 w-12 text-right">2w ago</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-6">
        {/* RESOURCES */}
        <section>
          <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
            <ChevronDown className="w-4 h-4" /> 🔗 RESOURCES (3)
          </h2>
          <div className="bg-sidebar border border-divider rounded-lg p-4 flex flex-col gap-3">
            <a href="#" className="flex items-start gap-2 group">
              <LinkIcon className="w-4 h-4 text-foreground/40 mt-0.5 group-hover:text-accent transition-colors" />
              <div>
                <div className="text-sm font-medium group-hover:underline">Practice: TypeScript Exercises</div>
                <div className="text-xs text-foreground/40">typescript-exercises.github.io</div>
              </div>
            </a>
            <a href="#" className="flex items-start gap-2 group">
              <LinkIcon className="w-4 h-4 text-foreground/40 mt-0.5 group-hover:text-accent transition-colors" />
              <div>
                <div className="text-sm font-medium group-hover:underline">Practice: Total TypeScript</div>
                <div className="text-xs text-foreground/40">totaltypescript.com</div>
              </div>
            </a>
            <a href="#" className="flex items-start gap-2 group">
              <LinkIcon className="w-4 h-4 text-foreground/40 mt-0.5 group-hover:text-accent transition-colors" />
              <div>
                <div className="text-sm font-medium group-hover:underline">Docs: TS Handbook</div>
                <div className="text-xs text-foreground/40">typescriptlang.org</div>
              </div>
            </a>
          </div>
        </section>

        {/* QUICK NOTES */}
        <section>
          <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-pointer hover:text-foreground">
            <ChevronDown className="w-4 h-4" /> 📌 QUICK NOTES (2)
          </h2>
          <div className="flex flex-col gap-3">
            <div className="bg-sidebar border border-divider rounded-lg p-3 flex gap-3 text-sm">
              <Pin className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                "TS 5.5 added inferred type predicates — look into this"
              </div>
              <span className="text-xs text-foreground/40 whitespace-nowrap">12h ago</span>
            </div>
            <div className="bg-sidebar border border-divider rounded-lg p-3 flex gap-3 text-sm">
              <Pin className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                "satisfies keyword &gt; type assertion"
              </div>
              <span className="text-xs text-foreground/40 whitespace-nowrap">3d ago</span>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
