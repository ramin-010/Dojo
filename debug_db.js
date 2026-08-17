const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.dailyScheduleSlot.findMany({
    where: { date: new Date('2026-08-15T18:30:00Z') }
  });
  console.log("SLOTS AUG 16:");
  console.log(slots.map(s => ({ title: s.title, status: s.status, remark: s.remark })));
  
  const logs = await prisma.blockSessionLog.findMany({
    where: { date: new Date('2026-08-15T18:30:00Z') }
  });
  console.log("LOGS AUG 16:");
  console.log(logs.map(l => ({ id: l.timeBlockId, status: l.status, remark: l.remark })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
