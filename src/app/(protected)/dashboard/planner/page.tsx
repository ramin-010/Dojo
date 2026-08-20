import PlannerClient from './PlannerClient';
import { getTimeBlocks, getTasksAndRevisionsForMonth } from '@/app/actions';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export default async function PlannerPage() {
  const { workspaceId } = await getSession();
  const now = new Date();

  // Fire all independent queries in parallel
  const [blocks, workspace, { tasks, revisions }] = await Promise.all([
    getTimeBlocks(),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { routineMode: true }
    }),
    getTasksAndRevisionsForMonth(now.getFullYear(), now.getMonth()),
  ]);

  return <PlannerClient initialBlocks={blocks} initialTasks={tasks} initialRevisions={revisions} initialRoutineMode={workspace?.routineMode || 'MASTER'} />;
}
