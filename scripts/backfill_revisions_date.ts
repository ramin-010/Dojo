import { prisma } from '../src/lib/db';

async function backfill() {
  console.log('Starting backfill...');
  
  // Find all revisions
  const revisions = await prisma.revision.findMany({
    select: { id: true, topicId: true }
  });
  
  console.log(`Found ${revisions.length} revisions.`);
  
  // Group by topic to minimize queries
  const topicIds = [...new Set(revisions.map(r => r.topicId))];
  
  let updatedCount = 0;
  
  for (const topicId of topicIds) {
    // Find the STARTED_REVISIONS log for this topic
    const log = await prisma.activityLog.findFirst({
      where: { 
        topicId: topicId,
        action: 'STARTED_REVISIONS'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (log) {
      // Update all revisions for this topic
      const result = await prisma.revision.updateMany({
        where: { topicId: topicId },
        data: { createdAt: log.createdAt }
      });
      console.log(`Topic ${topicId}: Updated ${result.count} revisions to ${log.createdAt}`);
      updatedCount += result.count;
    }
  }
  
  console.log(`Backfill complete. Updated ${updatedCount} revisions.`);
  process.exit(0);
}

backfill().catch(e => {
  console.error(e);
  process.exit(1);
});
