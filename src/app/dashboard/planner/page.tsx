import PlannerClient from './PlannerClient';
import { getTimeBlocks, getTasksAndRevisionsForMonth } from '@/app/actions';

import { prisma } from '@/lib/db';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

export default async function PlannerPage() {
  const blocks = await getTimeBlocks();
  
  const workspace = await prisma.workspace.findUnique({
    where: { id: DEV_WORKSPACE_ID },
    select: { routineMode: true }
  });
  
  // By default fetch for the current month
  const now = new Date();
  const { tasks, revisions } = await getTasksAndRevisionsForMonth(now.getFullYear(), now.getMonth());

  return <PlannerClient initialBlocks={blocks} initialTasks={tasks} initialRevisions={revisions} initialRoutineMode={workspace?.routineMode || 'MASTER'} />;
}
