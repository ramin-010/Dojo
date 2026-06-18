import { ArrowLeft, Clock, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Editor from "@/components/Editor";

export default function TopicPage({ params }: { params: { id: string } }) {
  // Dummy data for now
  const topic = {
    id: params.id,
    title: "React Server Components Deep Dive",
    subject: "Next.js Architecture",
    status: "pending",
    day: 1,
    content: "<h3>Hydration vs Serialization</h3><p>Server components serialize to a special format...</p>"
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full h-full flex flex-col">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-hover rounded-md text-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-sm font-medium text-foreground/50 uppercase tracking-wider">
          {topic.subject}
        </div>
      </div>

      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-3 text-foreground">{topic.title}</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-accent font-medium bg-accent/10 px-2 py-1 rounded">
              <Clock className="w-4 h-4" /> Day {topic.day} Revision
            </span>
            <span className="flex items-center gap-1 text-foreground/50">
              <Calendar className="w-4 h-4" /> Next due: Today
            </span>
          </div>
        </div>
        
        <button className="flex items-center gap-2 bg-accent hover:bg-[#026EC1] text-white px-4 py-2 rounded-md font-medium transition-colors">
          <CheckCircle2 className="w-4 h-4" />
          Mark as Revised
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pr-4">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Your Notes</h3>
          <Editor initialContent={topic.content} />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Linked Context (Symlinks)</h3>
          <div className="grid gap-3">
            {/* Dummy Symlink */}
            <div className="p-4 rounded-md border border-divider bg-sidebar">
              <div className="text-xs text-foreground/50 mb-1">Provides background on</div>
              <Link href="#" className="font-medium text-accent hover:underline">
                Client Component Boundaries
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
