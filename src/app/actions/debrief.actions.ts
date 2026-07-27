'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';

export interface SaveDebriefInput {
  id?: string;
  workspaceId: string;
  date: Date;
  
  // Layer 1
  blocksPlanned: number;
  blocksCompleted: number;
  blocksSkipped: number;
  totalFocusedMin: number;

  // Layer 2
  energy?: number | null;
  focus?: number | null;
  mood?: number | null;
  tags?: string[];
  narrative?: string | null;
  tomorrowIntent?: string | null;

  // Layer 3
  freeWrite?: string | null;
}

export async function getDebriefForDate(workspaceId: string, date: Date) {
  const normalizedDate = startOfDay(new Date(date));
  
  try {
    const debrief = await prisma.dayDebrief.findUnique({
      where: {
        workspaceId_date: {
          workspaceId,
          date: normalizedDate,
        },
      },
    });
    return { success: true, debrief };
  } catch (error) {
    console.error('Failed to get debrief:', error);
    return { success: false, error: 'Failed to fetch debrief' };
  }
}

export async function saveDebrief(data: SaveDebriefInput) {
  const normalizedDate = startOfDay(new Date(data.date));
  
  try {
    const debrief = await prisma.dayDebrief.upsert({
      where: {
        workspaceId_date: {
          workspaceId: data.workspaceId,
          date: normalizedDate,
        },
      },
      create: {
        workspaceId: data.workspaceId,
        date: normalizedDate,
        blocksPlanned: data.blocksPlanned,
        blocksCompleted: data.blocksCompleted,
        blocksSkipped: data.blocksSkipped,
        totalFocusedMin: data.totalFocusedMin,
        energy: data.energy,
        focus: data.focus,
        mood: data.mood,
        tags: data.tags || [],
        narrative: data.narrative,
        tomorrowIntent: data.tomorrowIntent,
        freeWrite: data.freeWrite,
      },
      update: {
        blocksPlanned: data.blocksPlanned,
        blocksCompleted: data.blocksCompleted,
        blocksSkipped: data.blocksSkipped,
        totalFocusedMin: data.totalFocusedMin,
        energy: data.energy,
        focus: data.focus,
        mood: data.mood,
        tags: data.tags || [],
        narrative: data.narrative,
        tomorrowIntent: data.tomorrowIntent,
        freeWrite: data.freeWrite,
      },
    });

    revalidatePath('/dashboard');
    return { success: true, debrief };
  } catch (error) {
    console.error('Failed to save debrief:', error);
    return { success: false, error: 'Failed to save debrief' };
  }
}
