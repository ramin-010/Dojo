import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from "@/components/navigation/Sidebar";
import { getSubjectsWithTopics } from "@/app/actions/subject.actions";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('revise_auth')?.value === 'authenticated';

  if (!isAuthenticated) {
    redirect('/login');
  }

  // Fetch subjects for the Sidebar
  const subjects = await getSubjectsWithTopics();

  return (
    <>
      <Sidebar initialSubjects={subjects} />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </>
  );
}
