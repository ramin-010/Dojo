import { notFound } from 'next/navigation';
import { getSubjectById, getRecentActivity, getUserStreak, getDailyHistory } from '@/app/actions';
import { SubjectContent } from './SubjectContent';

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [subject, activities, streak, dailyHistory] = await Promise.all([
    getSubjectById(id),
    getRecentActivity(id),
    getUserStreak(),
    getDailyHistory(7),
  ]);

  if (!subject) {
    notFound();
  }

  return (
    <SubjectContent
      subject={subject}
      activities={activities}
      streak={streak}
      dailyHistory={dailyHistory}
    />
  );
}
