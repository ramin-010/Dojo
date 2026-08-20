import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { name, email, password, rememberMe = true } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Create user + workspace in a transaction
    const hashedPassword = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: name?.trim() || email.split('@')[0],
          password: hashedPassword,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          userId: user.id,
          name: `${user.name}'s Workspace`,
        },
      });

      return { user, workspace };
    });

    // Create session
    await createSession(result.user.id, result.workspace.id, rememberMe);

    return NextResponse.json({ 
      success: true, 
      user: { id: result.user.id, name: result.user.name, email: result.user.email } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
