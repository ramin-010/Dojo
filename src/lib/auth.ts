'use server';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);

const COOKIE_NAME = 'revise_session';

export interface Session {
  userId: string;
  workspaceId: string;
}

// ── Password Utilities ───────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT Session Utilities ────────────────────────────────────────────

export async function createSession(userId: string, workspaceId: string, rememberMe: boolean = true): Promise<void> {
  const token = await new SignJWT({ userId, workspaceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '365d' : '1d')
    .sign(JWT_SECRET);

  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  
  if (rememberMe) {
    cookieOptions.maxAge = 60 * 60 * 24 * 365; // 1 year
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, cookieOptions);

  // Also keep the legacy cookie for backwards compatibility during migration
  cookieStore.set('revise_auth', 'authenticated', cookieOptions);
}

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      workspaceId: payload.workspaceId as string,
    };
  } catch {
    throw new Error('Invalid session');
  }
}

export async function getSessionSafe(): Promise<Session | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete('revise_auth');
}
