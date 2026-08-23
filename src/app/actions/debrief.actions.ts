'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import { getISTMidnight } from '@/lib/utils';
import { SlotStatus, BlockStatus } from '@prisma/client';

export interface SlotLogInput {
  slotId: string;
  sourceBlockId: string | null;
  status: SlotStatus;
  remark?: string | null;
  minutesDone?: number | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
}

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

  // Layer 4 (New: End of Day Logging)
  slotLogs?: SlotLogInput[];
}

export async function getDebriefForDate(workspaceId: string, date: Date) {
  const normalizedDate = getISTMidnight(new Date(date));
  
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
  const normalizedDate = getISTMidnight(new Date(data.date));
  
  try {
    const debrief = await prisma.$transaction(async (tx) => {
      // 1. Save Debrief
      const debriefResult = await tx.dayDebrief.upsert({
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

      // 2. Process bulk slot logs
      if (data.slotLogs && data.slotLogs.length > 0) {
        for (const log of data.slotLogs) {
          // Update the schedule slot
          await tx.dailyScheduleSlot.update({
            where: { id: log.slotId },
            data: {
              status: log.status,
              remark: log.remark,
              minutesDone: log.minutesDone,
              actualStartTime: log.actualStartTime,
              actualEndTime: log.actualEndTime,
            }
          });

          // Generate BlockSessionLog if it has a source block and it reached a terminal state
          if (log.sourceBlockId && (log.status === 'COMPLETED' || log.status === 'SKIPPED' || log.status === 'PARTIAL')) {
            const blockStatus: BlockStatus = log.status === 'SKIPPED' ? 'SKIPPED' : (log.status === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED');
            
            await tx.blockSessionLog.upsert({
              where: {
                timeBlockId_date: {
                  timeBlockId: log.sourceBlockId,
                  date: normalizedDate,
                }
              },
              update: {
                status: blockStatus,
                remark: log.remark,
                minutesDone: log.minutesDone
              },
              create: {
                timeBlockId: log.sourceBlockId,
                date: normalizedDate,
                status: blockStatus,
                remark: log.remark,
                minutesDone: log.minutesDone
              }
            });
          }
        }
      }

      return debriefResult;
    });

    revalidatePath('/dashboard');
    return { success: true, debrief };
  } catch (error) {
    console.error('Failed to save debrief:', error);
    return { success: false, error: 'Failed to save debrief' };
  }
}
