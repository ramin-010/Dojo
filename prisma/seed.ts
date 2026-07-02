import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const DEV_USER_ID = 'dev-user-local-001';
const DEV_WORKSPACE_ID = 'dev-workspace-local-001';

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create the dev user (upsert to avoid duplicates on re-run)
  const user = await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      name: 'Local Dev User',
      email: 'dev@dojo.local',
    },
  });
  console.log(`✅ User: ${user.name} (${user.id})`);

  // 2. Create the default workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: DEV_WORKSPACE_ID },
    update: {},
    create: {
      id: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      name: 'My Workspace',
    },
  });
  console.log(`✅ Workspace: ${workspace.name} (${workspace.id})`);

  // 3. Create a Dummy Subject
  const dummySubject = await prisma.subject.create({
    data: {
      workspaceId: workspace.id,
      name: 'Software Engineering',
      description: 'A study on building great software.',
      color: 'blue',
    },
  });
  console.log(`✅ Subject: ${dummySubject.name}`);

  // 4. Create a Dummy Topic
  const dummyTopic = await prisma.topic.create({
    data: {
      subjectId: dummySubject.id,
      title: 'Database Architecture',
      sortOrder: 1,
    },
  });
  console.log(`✅ Topic: ${dummyTopic.title}`);

  // 5. Create a Dummy Global Quick Note
  await prisma.capture.create({
    data: {
      workspaceId: workspace.id,
      type: 'NOTE',
      title: 'Global Idea',
      content: 'We should definitely look into vector embeddings for search.',
    },
  });

  // 6. Create a Dummy Topic Quick Note
  await prisma.capture.create({
    data: {
      workspaceId: workspace.id,
      subjectId: dummySubject.id,
      topicId: dummyTopic.id,
      type: 'NOTE',
      title: 'Topic Note',
      content: 'Postgres handles JSONB extremely well for these schema variations.',
    },
  });
  console.log(`✅ Quick Notes seeded`);

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
