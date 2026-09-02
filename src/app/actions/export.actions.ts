'use server';

import { prisma } from '@/lib/db';
import { getISTMidnight } from '@/lib/utils';
import { getSession } from '@/lib/auth';

export async function getAiExportData(workspaceId: string, fromDate: Date, toDate: Date) {
  try {
    const { userId } = await getSession();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const start = getISTMidnight(fromDate);
    const end = getISTMidnight(toDate);
    // Include the entire end date by adding 1 day
    const endPlusOne = new Date(end);
    endPlusOne.setDate(endPlusOne.getDate() + 1);

    // Fetch debriefs
    const debriefs = await prisma.dayDebrief.findMany({
      where: {
        workspaceId,
        date: {
          gte: start,
          lt: endPlusOne,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Fetch slot logs
    const slotLogs = await prisma.blockSessionLog.findMany({
      where: {
        timeBlock: { workspaceId },
        date: {
          gte: start,
          lt: endPlusOne,
        },
      },
      include: {
        timeBlock: {
          select: { title: true, startTime: true, endTime: true },
        },
      },
      orderBy: [{ date: 'asc' }, { timeBlock: { startTime: 'asc' } }],
    });

    // Group logs by date
    const logsByDate: Record<string, typeof slotLogs> = {};
    for (const log of slotLogs) {
      const dStr = log.date.toISOString().split('T')[0];
      if (!logsByDate[dStr]) logsByDate[dStr] = [];
      logsByDate[dStr].push(log);
    }

    // Build the prompt
    let prompt = `I am providing you with my daily productivity logs and debriefs from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}.\n\n`;
    prompt += `Please analyze this data to identify trends, patterns, habits, routines, and mistakes. Provide insights, constructive feedback, and actionable suggestions to improve my focus and routine.\n\n`;
    prompt += `### DATA LOGS ###\n\n`;

    for (let d = new Date(start); d < endPlusOne; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      const dayDebrief = debriefs.find((db) => db.date.toISOString().split('T')[0] === dStr);
      const dayLogs = logsByDate[dStr] || [];

      if (!dayDebrief && dayLogs.length === 0) continue;

      prompt += `=========================================\n`;
      prompt += `DATE: ${dStr}\n`;
      prompt += `=========================================\n\n`;

      if (dayDebrief) {
        prompt += `[DAILY DEBRIEF]\n`;
        prompt += `- Blocks Planned: ${dayDebrief.blocksPlanned}\n`;
        prompt += `- Blocks Completed: ${dayDebrief.blocksCompleted}\n`;
        prompt += `- Blocks Skipped: ${dayDebrief.blocksSkipped}\n`;
        prompt += `- Total Focused Time: ${dayDebrief.totalFocusedMin} minutes\n`;
        if (dayDebrief.energy !== null) prompt += `- Energy Level (1-5): ${dayDebrief.energy}\n`;
        if (dayDebrief.focus !== null) prompt += `- Focus Level (1-5): ${dayDebrief.focus}\n`;
        if (dayDebrief.mood !== null) prompt += `- Mood Level (1-5): ${dayDebrief.mood}\n`;
        if (dayDebrief.tags && dayDebrief.tags.length > 0) prompt += `- Tags: ${dayDebrief.tags.join(', ')}\n`;
        if (dayDebrief.narrative) prompt += `- Narrative: ${dayDebrief.narrative}\n`;
        if (dayDebrief.tomorrowIntent) prompt += `- Tomorrow's Intent: ${dayDebrief.tomorrowIntent}\n`;
        if (dayDebrief.freeWrite) prompt += `- Free Write: ${dayDebrief.freeWrite}\n`;
        prompt += `\n`;
      }

      if (dayLogs.length > 0) {
        prompt += `[SCHEDULE BLOCKS]\n`;
        for (const log of dayLogs) {
          prompt += `- ${log.timeBlock.startTime}-${log.timeBlock.endTime} | ${log.timeBlock.title} | Status: ${log.status}`;
          if (log.minutesDone) prompt += ` | Mins Done: ${log.minutesDone}`;
          if (log.remark) prompt += ` | Remark: "${log.remark}"`;
          prompt += `\n`;
        }
        prompt += `\n`;
      }
    }

    return { success: true, data: prompt };
  } catch (error) {
    console.error('Failed to get export data:', error);
    return { success: false, error: 'Failed to generate export' };
  }
}
