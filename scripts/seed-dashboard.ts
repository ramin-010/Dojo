import { prisma } from '../src/lib/db';

const DEV_WORKSPACE_ID = 'dev-workspace-local-001';
const DEV_USER_ID = 'dev-user-local-001';

async function main() {
  console.log('Seeding dashboard data...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 1. Ensure user and workspace exist
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: 'dev@local.com',
      name: 'Dev User'
    }
  });

  await prisma.workspace.upsert({
    where: { id: DEV_WORKSPACE_ID },
    update: {},
    create: {
      id: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      name: 'Dev Workspace'
    }
  });

  // 2. Create Subject & Topic
  const subject = await prisma.subject.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      name: 'Computer Science',
      color: '#10b981',
      icon: 'Code'
    }
  });

  const topic = await prisma.topic.create({
    data: {
      subjectId: subject.id,
      title: 'Graph Algorithms'
    }
  });

  // 3. Create Revision for Topic
  await prisma.revision.create({
    data: {
      topicId: topic.id,
      cycleNumber: 1,
      intervalDays: 1,
      scheduledFor: today,
      status: 'pending'
    }
  });

  // 4. Create Tasks
  await prisma.capture.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      type: 'TASK',
      title: 'Review PRs for frontend',
      isDone: false,
      goalType: 'NONE',
      dueDate: today
    }
  });

  await prisma.capture.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      type: 'TASK',
      title: 'Ship dashboard updates',
      isDone: false,
      goalType: 'WEEKLY',
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
    }
  });

  // 5. Create Inbox item (Capture with no subject)
  await prisma.capture.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      type: 'NOTE',
      content: 'Just had an idea about implementing a unified search bar across all workspaces.',
      title: 'Unified Search Idea',
      isPinned: false
    }
  });

  // 6. Create Habit
  await prisma.habit.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      name: 'Read 10 pages',
      icon: 'Book',
      color: '#3b82f6',
      currentStreak: 3
    }
  });

  // 7. Create TimeBlock
  await prisma.timeBlock.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      title: 'Deep Work',
      startTime: '09:00',
      endTime: '11:00',
      color: '#8b5cf6',
      dayOfWeek: today.getDay()
    }
  });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
