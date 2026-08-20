import { notFound } from 'next/navigation';
import { getTopicById, getAllSubjectTags, getAdjacentTopics, getWorkspaceNoteCategories } from '@/app/actions';
import { TopicWorkspace } from './TopicWorkspace';

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const topic = await getTopicById(id);

  if (!topic) {
    notFound();
  }

  // Fire all independent queries in parallel (all depend on topic, but not on each other)
  const [allSubjectTags, adjacentTopics, noteCategoriesResult] = await Promise.all([
    getAllSubjectTags(topic.subjectId),
    getAdjacentTopics(topic.subjectId, topic.id),
    getWorkspaceNoteCategories(),
  ]);

  return (
    <TopicWorkspace 
      topic={topic} 
      allSubjectTags={allSubjectTags} 
      adjacentTopics={{ prev: adjacentTopics.prevTopic, next: adjacentTopics.nextTopic }}
      noteCategories={noteCategoriesResult.categories || []}
    />
  );
}
