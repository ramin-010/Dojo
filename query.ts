import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  const logs = await prisma.blockSessionLog.findMany({
    where: {
      date: new Date('2026-08-26T00:00:00.000Z')
    }
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
