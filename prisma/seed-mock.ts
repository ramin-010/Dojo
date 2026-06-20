import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const DEV_WORKSPACE_ID = 'dev-workspace-local-001';

async function main() {
  console.log('🌱 Seeding mock data for Sidebar UI...');

  // Create Subject 1
  const subj1 = await prisma.subject.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      name: 'TypeScript Prep',
      topics: {
        create: [
          { title: 'Generics', sortOrder: 1 },
          { title: 'Utility Types', sortOrder: 2 },
          { title: 'Advanced Inference', sortOrder: 3 },
        ],
      },
    },
  });

  // Create Subject 2
  const subj2 = await prisma.subject.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      name: 'System Design',
      topics: {
        create: [
          { title: 'CAP Theorem', sortOrder: 1 },
          { title: 'Message Queues', sortOrder: 2 },
          { title: 'Database Sharding', sortOrder: 3 },
        ],
      },
    },
  });

  console.log('✅ Created mock subjects and topics!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
