/**
 * Smart Date Parser - Natural Language Date/Time Extraction
 * 
 * Parses natural language date/time expressions from task input.
 * Supports patterns like:
 * - "tomorrow", "today"
 * - "by Friday", "on Monday"
 * - "by 6pm", "at 6:30 am"
 * - "by 6pm on Monday", "on the 20th at 3pm"
 * - "next week", "in 3 days"
 */

import { format, isToday, isTomorrow, addDays, setHours, setMinutes, nextDay, getDay } from 'date-fns';

export interface ParsedTaskInput {
  cleanText: string;
  dueDate: Date | null;
  reminderDate: Date | null;
  hasDate: boolean;
  hasTime: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedText: string | null; // The date portion that was matched (legacy, keeping for types)
  matchedSegments: string[]; // All matched segments
}

// Day name to index mapping
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Helper for partial day matching (e.g., "wed" -> "wednesday")
// Scans all words in text for partial matches
function findPartialDayMatch(text: string): { dayName: string; matched: string; dayIndex: number } | null {
  const words = text.split(/\s+/);
  
  // Check each word for partial day name match
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    if (lowerWord.length < 2) continue;
    
    for (let i = 0; i < DAY_NAMES.length; i++) {
      // Partial match: word starts a day name but isn't complete
      if (DAY_NAMES[i].startsWith(lowerWord) && lowerWord !== DAY_NAMES[i]) {
        return { dayName: DAY_NAMES[i], matched: lowerWord, dayIndex: i };
      }
    }
  }
  return null;
}

/**
 * Parse natural language date/time from task text
 */
export function parseTaskInput(text: string): ParsedTaskInput {
  let dueDate: Date | null = null;
  let cleanText = text;
  const lower = text.toLowerCase();
  
  const baseDate = new Date();
  let hasDate = false;
  let hasTime = false;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let matchedText: string | null = null;
  let matchedSegments: string[] = [];

  // Helper to record match
  const addMatch = (match: string) => {
    matchedText = match; // Keep track of last/main match for legacy
    matchedSegments.push(match);
  };
  

  // ============ DATE PATTERNS ============
  
  // 1. "tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    dueDate = addDays(new Date(), 1);
    hasDate = true;
    confidence = 'high';
    addMatch('tomorrow');
    cleanText = cleanText.replace(/\btomorrow\b/gi, '');
  }
  
  // 2. "today"
  if (/\btoday\b/.test(lower)) {
    dueDate = new Date();
    hasDate = true;
    confidence = 'high';
    addMatch('today');
    cleanText = cleanText.replace(/\btoday\b/gi, '');
  }

  // 3. "next week"
  if (/\bnext\s+week\b/.test(lower)) {
    dueDate = addDays(new Date(), 7);
    hasDate = true;
    confidence = 'medium';
    addMatch('next week');
    cleanText = cleanText.replace(/\bnext\s+week\b/gi, '');
  }

  // 4. "in X days/day"
  const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    dueDate = addDays(new Date(), days);
    hasDate = true;
    confidence = 'high';
    addMatch(inDaysMatch[0]);
    cleanText = cleanText.replace(/\bin\s+\d+\s+days?\b/gi, '');
  }

  // 5. Day of week: "on Monday", "by Friday", "next Tuesday" - FULL MATCH
  const dayPattern = /(?:on|by|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
  const dayMatch = lower.match(dayPattern);
  if (dayMatch) {
    const targetDayName = dayMatch[1].toLowerCase();
    const targetDayIndex = DAY_NAMES.indexOf(targetDayName);
    const currentDayIndex = getDay(new Date());
    
    let daysUntil = targetDayIndex - currentDayIndex;
    if (daysUntil <= 0 || lower.includes('next')) {
      daysUntil += 7;
    }
    
    dueDate = addDays(new Date(), daysUntil);
    hasDate = true;
    confidence = 'high';
    addMatch(dayMatch[0]);
    cleanText = cleanText.replace(new RegExp(dayMatch[0], 'gi'), '');
  }

  // 5b. Standalone day name (full word) without prefix: "wednesday", "friday"
  if (!dayMatch) {
    const standaloneDayPattern = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
    const standaloneMatch = lower.match(standaloneDayPattern);
    if (standaloneMatch) {
      const targetDayName = standaloneMatch[1].toLowerCase();
      const targetDayIndex = DAY_NAMES.indexOf(targetDayName);
      const currentDayIndex = getDay(new Date());
      
      let daysUntil = targetDayIndex - currentDayIndex;
      if (daysUntil <= 0) {
        daysUntil += 7;
      }
      
      dueDate = addDays(new Date(), daysUntil);
      hasDate = true;
      confidence = 'high';
      addMatch(standaloneMatch[1]);
      cleanText = cleanText.replace(new RegExp(standaloneMatch[0], 'gi'), '');
    }
  }

  // 5c. PARTIAL day name match: "wed" -> "wednesday" (suggestion mode)
  if (!hasDate) {
    const partialMatch = findPartialDayMatch(lower);
    if (partialMatch) {
      const currentDayIndex = getDay(new Date());
      let daysUntil = partialMatch.dayIndex - currentDayIndex;
      if (daysUntil <= 0) {
        daysUntil += 7;
      }
      
      dueDate = addDays(new Date(), daysUntil);
      hasDate = true;
      confidence = 'medium'; // Medium because it's partial
      addMatch(partialMatch.matched);
      // Don't clean text yet - let user confirm
    }
  }

  // 6. Date of month: "on the 20th", "on 15th", "by the 25th"
  // Added negative lookahead to prevent matching if followed by time-like colon/dot + number
  const datePattern = /(?:on|by)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*[:.]\s*\d)\b/i;
  const dateMatch = lower.match(datePattern);
  if (dateMatch && !dayMatch && !hasDate) {
    const dayOfMonth = parseInt(dateMatch[1]);
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      dueDate = dueDate || new Date();
      dueDate.setDate(dayOfMonth);
      if (dueDate < new Date()) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      hasDate = true;
      confidence = 'high';
      addMatch(dateMatch[0]);
      cleanText = cleanText.replace(new RegExp(dateMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
  }

  // 7. Full date: "on January 20", "by March 15th"
  const fullDatePattern = new RegExp(
    `(?:on|by)\\s+(${MONTH_NAMES.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?`,
    'i'
  );
  const fullDateMatch = lower.match(fullDatePattern);
  if (fullDateMatch) {
    const monthName = fullDateMatch[1].toLowerCase();
    const monthIndex = MONTH_NAMES.indexOf(monthName);
    const day = parseInt(fullDateMatch[2]);
    const year = fullDateMatch[3] ? parseInt(fullDateMatch[3]) : new Date().getFullYear();
    
    dueDate = new Date(year, monthIndex, day);
    // If date is in the past and no year was specified, assume next year
    if (dueDate < new Date() && !fullDateMatch[3]) {
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    }
    hasDate = true;
    confidence = 'high';
    addMatch(fullDateMatch[0]);
    cleanText = cleanText.replace(new RegExp(fullDateMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }

  // ============ TIME PATTERNS ============
  
  // Time: "at 6pm", "by 6:30 am", "6pm", "at 14:00", "2 : 30 pm", "2.30pm"
  // Supports spaces around colon, dot separator, and optional space before meridiem
  const timePattern = /(?:at|by)?\s*(\d{1,2})\s*([:.]|(?=\s*(?:am|pm|a|p)\b))\s*(\d{2})?\s*(am|pm|a|p)\b|(?:\b(?:at|by)\s+)(\d{1,2})\s*([:.]\s*(\d{2}))?(?!\d)/i;
  
  const timeMatch = lower.match(timePattern);
  
  if (timeMatch) {
    let hours = 0;
    let minutes = 0;
    let meridiem: string | undefined;
    
    // Group 1-4 match times with meridiem suffix (e.g. "6pm", "2 : 30 pm")
    if (timeMatch[1]) {
      hours = parseInt(timeMatch[1]);
      minutes = parseInt(timeMatch[3] || '0');
      meridiem = timeMatch[4]?.toLowerCase();
    } 
    // Group 5-7 match times with explicit prefix but no suffix (e.g. "at 14:00")
    else if (timeMatch[5]) {
      hours = parseInt(timeMatch[5]);
      minutes = parseInt(timeMatch[7] || '0');
    }

    // Convert to 24-hour format if meridiem is present
    if (meridiem) {
      if ((meridiem === 'pm' || meridiem === 'p') && hours < 12) hours += 12;
      if ((meridiem === 'am' || meridiem === 'a') && hours === 12) hours = 0;
    }
    
    // Validate hours
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      dueDate = dueDate || new Date();
      dueDate = setHours(dueDate, hours);
      dueDate = setMinutes(dueDate, minutes);
      dueDate.setSeconds(0, 0);
      hasTime = true;
      confidence = hasDate ? 'high' : 'medium';
      
      // Record the match
      addMatch(timeMatch[0]);
      cleanText = cleanText.replace(new RegExp(timeMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
  }

  // ============ PARTIAL MONTH PATTERNS (Run before standalone numbers) ============

  // 8. Partial Month + Day: "jan 12", "feb 28", "dec 25th"
  // Needs to be length >= 3 to avoid noise (except 'may')
  if (!hasDate) {
    const partialDatePattern = /\b([a-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
    const partialMatch = lower.match(partialDatePattern);
    
    if (partialMatch) {
      // Check if first group is a partial month
      const word = partialMatch[1].toLowerCase();
      let foundMonthIndex = -1;
      
      for (let i = 0; i < MONTH_NAMES.length; i++) {
         if (MONTH_NAMES[i].startsWith(word)) {
           foundMonthIndex = i;
           break;
         }
      }

      if (foundMonthIndex !== -1) {
        const day = parseInt(partialMatch[2]);
        if (day >= 1 && day <= 31) {
           dueDate = dueDate || new Date();
           dueDate.setMonth(foundMonthIndex);
           dueDate.setDate(day);
           
           // Handle year roll-over
           if (dueDate < new Date()) {
             dueDate.setFullYear(dueDate.getFullYear() + 1);
           }
           
           hasDate = true;
           confidence = 'high';
           addMatch(partialMatch[0]);
           cleanText = cleanText.replace(new RegExp(partialMatch[0], 'gi'), '');
        }
      }
    }
  }

  // 9. Day + Partial Month: "12 jan", "25th dec"
  if (!hasDate) {
    const partialDateRevPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})\b/i;
    const partialRevMatch = lower.match(partialDateRevPattern);
    
    if (partialRevMatch) {
      const day = parseInt(partialRevMatch[1]);
      const word = partialRevMatch[2].toLowerCase();
      let foundMonthIndex = -1;
      
       for (let i = 0; i < MONTH_NAMES.length; i++) {
         if (MONTH_NAMES[i].startsWith(word)) {
           foundMonthIndex = i;
           break;
         }
      }

      if (foundMonthIndex !== -1 && day >= 1 && day <= 31) {
           dueDate = dueDate || new Date();
           dueDate.setMonth(foundMonthIndex);
           dueDate.setDate(day);
           
           if (dueDate < new Date()) {
             dueDate.setFullYear(dueDate.getFullYear() + 1);
           }
           
           hasDate = true;
           confidence = 'high';
           addMatch(partialRevMatch[0]);
           cleanText = cleanText.replace(new RegExp(partialRevMatch[0], 'gi'), '');
      }
    }
  }

  // 6b. Standalone ordinal date: "19th", "20th", "1st" (without on/by prefix)
  // MOVED HERE: so it checks after specific Month+Day combinations
  if (!hasDate) {
    const standaloneOrdinalPattern = /\b(\d{1,2})(st|nd|rd|th)\b/i;
    const standaloneOrdinalMatch = lower.match(standaloneOrdinalPattern);
    if (standaloneOrdinalMatch) {
      const dayOfMonth = parseInt(standaloneOrdinalMatch[1]);
      if (dayOfMonth >= 1 && dayOfMonth <= 31) {
        dueDate = new Date();
        dueDate.setDate(dayOfMonth);
        if (dueDate < new Date()) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
        hasDate = true;
        confidence = 'high';
        addMatch(standaloneOrdinalMatch[0]);
        cleanText = cleanText.replace(new RegExp(standaloneOrdinalMatch[0], 'gi'), '');
      }
    }
  }

  // 10. Standalone Partial Month: "feb", "january" (defaults to 1st of that month)
  if (!hasDate) {
    // Find any word that partially matches a month name (min 3 chars)
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      
      let foundMonthIndex = -1;
      for (let i = 0; i < MONTH_NAMES.length; i++) {
        if (MONTH_NAMES[i].startsWith(word)) {
          foundMonthIndex = i;
          break;
        }
      }
      
      if (foundMonthIndex !== -1) {
        dueDate = new Date();
        dueDate.setMonth(foundMonthIndex);
        dueDate.setDate(1); // Default to 1st
        
        // If that date has passed, assume next year
        if (dueDate < new Date()) {
          dueDate.setFullYear(dueDate.getFullYear() + 1);
        }
        
        hasDate = true;
        confidence = 'medium';
        addMatch(word);
        // Don't clean text for standalone month suggestions, let user see highlighting
        break; 
      }
    }
  }

  // ============ DEFAULTS ============
  
  // If we have a date but no time, default to 6 PM
  if (hasDate && !hasTime && dueDate) {
    dueDate = setHours(dueDate, 18);
    dueDate = setMinutes(dueDate, 0);
    dueDate.setSeconds(0, 0);
  }
  
  // If we have only time but no date, assume today (or tomorrow if time has passed)
  if (hasTime && !hasDate && dueDate) {
    const now = new Date();
    if (dueDate.getHours() < now.getHours() || 
        (dueDate.getHours() === now.getHours() && dueDate.getMinutes() <= now.getMinutes())) {
      dueDate = addDays(dueDate, 1);
    }
    hasDate = true;
  }

  // Clean up text
  cleanText = cleanText
    .replace(/\s+/g, ' ')
    .replace(/^\s*(by|at|on)\s*/i, '')
    .trim();

  return {
    cleanText,
    dueDate: (hasDate || hasTime) ? dueDate : null,
    reminderDate: null,
    hasDate,
    hasTime,
    confidence,
    matchedText,
    matchedSegments
  };
}

/**
 * Format parsed date for display in Quick Input
 */
export function formatParsedDate(date: Date | null): string | null {
  if (!date) return null;
  
  const timeStr = format(date, 'h:mm a');
  
  if (isToday(date)) {
    return `${timeStr} Today`;
  }
  
  if (isTomorrow(date)) {
    return `${timeStr} Tomorrow`;
  }
  
  // Within this week, show day name
  const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 7) {
    return `${timeStr} ${format(date, 'EEEE')}`;
  }
  
  // Otherwise show full date
  return `${timeStr} ${format(date, 'MMM d')}`;
}
