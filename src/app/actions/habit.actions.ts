'use server';

import { prisma } from '@/lib/db';
import { DEV_WORKSPACE_ID } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

export async function getHabits() {
  try {
    const habits = await prisma.habit.findMany({
      where: {
        workspaceId: DEV_WORKSPACE_ID,
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
  try {
    const habit = await prisma.habit.create({
      data: {
        workspaceId: DEV_WORKSPACE_ID,
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
    // Normalize "today" to start of day for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let newStreak = habit.currentStreak;
    let newLongest = habit.longestStreak;

    if (habit.lastCompletedAt) {
      const last = new Date(habit.lastCompletedAt);
      const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      
      const diffTime = today.getTime() - lastDay.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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
