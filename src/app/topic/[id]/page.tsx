import { notFound } from 'next/navigation';
import { getTopicById, getAllSubjectTags, getAdjacentTopics } from '@/app/actions';
import { TopicWorkspace } from './TopicWorkspace';

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const topic = await getTopicById(id);

  if (!topic) {
    notFound();
  }

  const allSubjectTags = await getAllSubjectTags(topic.subjectId);
  const adjacentTopics = await getAdjacentTopics(topic.subjectId, topic.id);

  return <TopicWorkspace topic={topic} allSubjectTags={allSubjectTags} adjacentTopics={adjacentTopics} />;
}
