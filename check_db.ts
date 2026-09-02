import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  const logs = await prisma.blockSessionLog.findMany({ select: { date: true } });
  const uniqueDates = Array.from(new Set(logs.map(l => l.date.toISOString().split('T')[0])));
  console.log('Unique Log Dates:', uniqueDates.sort());

  const debriefs = await prisma.dayDebrief.findMany({ select: { date: true } });
  const uniqueDDates = Array.from(new Set(debriefs.map(d => d.date.toISOString().split('T')[0])));
  console.log('Unique Debrief Dates:', uniqueDDates.sort());
}

main().catch(console.error).finally(() => prisma.$disconnect());
