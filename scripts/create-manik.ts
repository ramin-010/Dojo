import 'dotenv/config';
import { prisma } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'manik@gmail.com';
  const password = 'manik123';
  const name = 'Manik';

  console.log(`Creating user: ${email}`);

  // check if exists
  const existing = await prisma.user.findUnique({ where: { email }});
  if (existing) {
    console.log('User already exists! Resetting password just in case.');
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashedPassword }
    });
    console.log('Password reset.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  
  await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, password: hashedPassword, name }
      });
      await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
          userId: user.id,
          routineMode: 'MASTER'
        }
      });
  });
  console.log('✅ Account successfully created for Manik!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
