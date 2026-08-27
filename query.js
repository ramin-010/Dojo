const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const blocks = await prisma.dailyScheduleSlot.findMany();
  console.log(JSON.stringify(blocks, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
