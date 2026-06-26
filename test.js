const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.resourceLink.findMany({ 
  select: { cloudPublicId: true, url: true, fileType: true }, 
  take: 10 
}).then(console.log).finally(() => prisma.$disconnect());
