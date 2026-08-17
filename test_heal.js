const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DEV_WORKSPACE_ID = 'dev-workspace-id';

async function main() {
  try {
    const now = new Date();
    const startRange = new Date(now);
    startRange.setDate(now.getDate() - 7);
    startRange.setHours(0, 0, 0, 0);

    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    const unverifiedSlots = await prisma.dailyScheduleSlot.findMany({
      where: { 
        workspaceId: DEV_WORKSPACE_ID,
        date: {
          gte: startRange,
          lt: todayMidnight
        },
        status: 'UPCOMING'
      },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }]
    });

    const sourceBlockIds = unverifiedSlots.map(s => s.sourceBlockId).filter(Boolean);
    const existingLogs = await prisma.blockSessionLog.findMany({
      where: {
        timeBlockId: { in: sourceBlockIds },
        date: {
          gte: startRange,
          lt: todayMidnight
        }
      }
    });

    const logMap = new Map();
    existingLogs.forEach(log => {
      const key = `${log.timeBlockId}_${log.date.getTime()}`;
      logMap.set(key, log);
    });

    console.log("AUTO-HEAL DEBUG: unverifiedSlots count =", unverifiedSlots.length);
    console.log("AUTO-HEAL DEBUG: existingLogs count =", existingLogs.length);
    console.log("AUTO-HEAL DEBUG: logMap keys =", Array.from(logMap.keys()));

    for (const slot of unverifiedSlots) {
      if (slot.sourceBlockId) {
        const key = `${slot.sourceBlockId}_${slot.date.getTime()}`;
        const existingLog = logMap.get(key);
        console.log("AUTO-HEAL DEBUG: Checking slot", slot.title, "key:", key, "found log:", !!existingLog, "log status:", existingLog?.status);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
