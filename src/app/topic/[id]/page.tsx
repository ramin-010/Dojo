import { notFound } from "next/navigation";
import { getTopicById } from "@/app/actions";
import { TopicWorkspace } from "./TopicWorkspace";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const topic = await getTopicById(id);

  if (!topic) {
    notFound();
  }

  // Pass the full Prisma Topic object (including includes) down
  return <TopicWorkspace topic={topic} />;
}
