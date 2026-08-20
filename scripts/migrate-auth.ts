import 'dotenv/config';
import { prisma } from '../src/lib/db';
import bcrypt from 'bcryptjs';
import { DEV_USER_ID, DEV_WORKSPACE_ID } from '../src/lib/constants';

// THIS SCRIPT RUNS ONCE TO SECURE THE DEV_USER_ID ACCOUNT
// It adds an email and hashed password to the original mock user so you can log in with it.

async function main() {
  console.log('Migrating existing dev user to secure authentication...');
  
  // Look for the original DEV_USER_ID
  const user = await prisma.user.findUnique({
    where: { id: DEV_USER_ID }
  });
  
  if (!user) {
    console.error('❌ Could not find original dev user:', DEV_USER_ID);
    console.error('If you already ran this script, or the DB is fresh, this is expected.');
    return;
  }
  
  const email = 'admin@revise.app';
  const password = process.env.APP_PASSWORD || 'ramin';
  
  console.log(`Setting credentials for original account...`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  await prisma.user.update({
    where: { id: DEV_USER_ID },
    data: {
      email,
      password: hashedPassword,
      name: 'Admin'
    }
  });
  
  // Make sure the workspace is linked
  const workspaceCount = await prisma.workspace.count({
    where: { id: DEV_WORKSPACE_ID, userId: DEV_USER_ID }
  });
  
  if (workspaceCount === 0) {
    console.log('Warning: Original dev workspace not found. The account is secured but might have no data.');
  }
  
  console.log('✅ Migration complete! You can now log in using:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
