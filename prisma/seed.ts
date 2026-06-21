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
