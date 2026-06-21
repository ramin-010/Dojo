import { notFound } from 'next/navigation';
import { getTopicById, getAllSubjectTags } from '@/app/actions';
import { TopicWorkspace } from './TopicWorkspace';

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const topic = await getTopicById(id);

  if (!topic) {
    notFound();
  }

  const allSubjectTags = await getAllSubjectTags(topic.subjectId);

  return <TopicWorkspace topic={topic} allSubjectTags={allSubjectTags} />;
}
