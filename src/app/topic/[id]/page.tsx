import { ArrowLeft, Clock, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { TopicWorkspace } from "./TopicWorkspace";
export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Dummy data for now
  const topic = {
    id,
    title: "React Server Components Deep Dive",
    subject: "Next.js Architecture",
    status: "pending",
    day: 1,
    content: "" // We will start with empty canvas for now
  };

  return <TopicWorkspace topic={topic} />;
}
