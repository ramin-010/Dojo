import { redirect } from 'next/navigation';
import { Sidebar } from "@/components/navigation/Sidebar";
import { getSubjectsWithTopics } from "@/app/actions/subject.actions";
import { getSessionSafe } from '@/lib/auth';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionSafe();

  if (!session) {
    redirect('/login');
  }

  // Fetch subjects for the Sidebar
  const subjects = await getSubjectsWithTopics();
  
  const { prisma } = await import('@/lib/db');
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true }
  });

  return (
    <>
      <Sidebar initialSubjects={subjects} userName={user?.name || 'User'} />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </>
  );
}
