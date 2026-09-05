'use server';

import { prisma } from '@/lib/db';
import { differenceInISTDays } from '@/lib/date';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getHabits() {
  const { userId, workspaceId } = await getSession();
  try {
    const habits = await prisma.habit.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'asc',
      }
    });
    return { success: true, habits };
  } catch (error: any) {
    console.error('Failed to get habits', error);
    return { error: 'Failed to get habits' };
  }
}

export async function createHabit(name: string, icon?: string, color?: string) {
  const { userId, workspaceId } = await getSession();
  try {
    const habit = await prisma.habit.create({
      data: {
        workspaceId,
        name,
        icon,
        color,
      }
    });
    revalidatePath('/dashboard');
    return { success: true, habit };
  } catch (error: any) {
    console.error('Failed to create habit', error);
    return { error: 'Failed to create habit' };
  }
}

export async function logHabit(habitId: string) {
  try {
    const habit = await prisma.habit.findUnique({
      where: { id: habitId }
    });

    if (!habit) return { error: 'Habit not found' };

    const now = new Date();

    let newStreak = habit.currentStreak;
    let newLongest = habit.longestStreak;

    if (habit.lastCompletedAt) {
      // Compare in IST day space rather than server-local days, so a habit
      // logged late at night counts against the day the user was living in.
      const diffDays = differenceInISTDays(now, habit.lastCompletedAt);

      if (diffDays === 0) {
        // Already logged today
        return { success: true, habit, alreadyLogged: true };
      } else if (diffDays === 1) {
        // Logged yesterday, increment streak
        newStreak += 1;
      } else if (diffDays > 1) {
        // Missed a day (or more), reset streak
        newStreak = 1;
      }
    } else {
      // First time logging
      newStreak = 1;
    }

    if (newStreak > newLongest) {
      newLongest = newStreak;
    }

    const updated = await prisma.habit.update({
      where: { id: habitId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCompletedAt: now,
      }
    });

    revalidatePath('/dashboard');
    return { success: true, habit: updated };
  } catch (error: any) {
    console.error('Failed to log habit', error);
    return { error: 'Failed to log habit' };
  }
}
