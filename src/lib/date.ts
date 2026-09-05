/**
 * ====================================================================
 * CANONICAL DATE HANDLING — READ THIS BEFORE TOUCHING ANY DATE LOGIC
 * ====================================================================
 *
 * The app runs on IST (UTC+5:30) but the server may be hosted anywhere
 * (Vercel = UTC, localhost = IST). Never use server-local date methods
 * (`getDay()`, `getDate()`, `new Date(y, m, d)`) — they silently produce
 * a different answer depending on where the code runs.
 *
 * There are TWO distinct concepts here. Keep them straight:
 *
 * 1. DAY LABEL (`getISTMidnight`)
 *    A calendar day, encoded as UTC midnight of that day.
 *    e.g. IST day 2026-09-05  ->  2026-09-05T00:00:00.000Z
 *    This is NOT the instant IST midnight actually occurs — it is a
 *    stable bucket key. Every day-bucketed column uses this encoding:
 *      DailyScheduleSlot.date, BlockSessionLog.date,
 *      DayDebrief.date, DailyHistory.date, Revision.scheduledFor
 *
 * 2. REAL INSTANT
 *    An actual point in time. Used by Capture.dueDate, Reminder.remindAt,
 *    Revision.completedAt, and every `createdAt`.
 *
 * Comparing a real instant against a day label works as long as the
 * instant is produced by `getISTEndOfDayLabel()` — see that function.
 */

/** IST is UTC+5:30 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the DAY LABEL for the IST calendar day containing `date`:
 * a UTC-midnight Date whose Y/M/D match the IST calendar day.
 *
 * Idempotent — passing a label back in returns the same label.
 */
export function getISTMidnight(date: Date = new Date()): Date {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate())
  );
}

/**
 * Day-of-week for the IST calendar day containing `date`, in the app's
 * convention: 0 = Monday ... 6 = Sunday.
 *
 * IMPORTANT: this matches `TimeBlock.dayOfWeek` and the `DAYS` array in
 * WeeklyTimetable. It is NOT the same as JS `Date.getDay()` (0 = Sunday).
 */
export function getISTDayOfWeek(date: Date = new Date()): number {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS);
  const jsDay = istTime.getUTCDay(); // 0 = Sun .. 6 = Sat
  return jsDay === 0 ? 6 : jsDay - 1; // 0 = Mon .. 6 = Sun
}

/**
 * Adds (or subtracts, with a negative `days`) whole days to a DAY LABEL.
 * Safe to chain — operates in UTC so there is no DST drift, and unlike
 * `d.setDate(d.getDate() + n)` it does not mutate the input.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The last millisecond of an IST calendar day, expressed so it compares
 * correctly against day labels produced by `getISTMidnight`.
 *
 * Use this for real-instant columns that mean "due by end of day"
 * (Capture.dueDate), so that `dueDate < getISTMidnight()` is true exactly
 * from the following IST day onward.
 */
export function getISTEndOfDayLabel(date: Date = new Date()): Date {
  return new Date(getISTMidnight(date).getTime() + DAY_MS - 1);
}

/**
 * Whole calendar days between two dates, measured in IST days.
 * Positive when `later` is after `earlier`.
 *
 *   differenceInISTDays(sep6, sep5) === 1
 */
export function differenceInISTDays(later: Date, earlier: Date): number {
  const a = getISTMidnight(later).getTime();
  const b = getISTMidnight(earlier).getTime();
  return Math.round((a - b) / DAY_MS);
}

/** True when both dates fall on the same IST calendar day. */
export function isSameISTDay(a: Date, b: Date): boolean {
  return getISTMidnight(a).getTime() === getISTMidnight(b).getTime();
}

/**
 * 'YYYY-MM-DD' for the IST calendar day containing `date`.
 * Use this instead of `date.toISOString().split('T')[0]`, which is only
 * correct when `date` is already a day label.
 */
export function toISTDateString(date: Date): string {
  return getISTMidnight(date).toISOString().split('T')[0];
}

/**
 * Parses a 'YYYY-MM-DD' string into the DAY LABEL for that IST day.
 * Avoids the `new Date('YYYY-MM-DD')` + local-timezone off-by-one trap.
 */
export function fromISTDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Inclusive list of day labels from `start` to `end`. */
export function eachISTDayInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = getISTMidnight(start);
  const last = getISTMidnight(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Last millisecond of the IST calendar month containing `date`, encoded to
 * compare correctly against day labels (see `getISTEndOfDayLabel`).
 */
export function getISTEndOfMonthLabel(date: Date = new Date()): Date {
  const label = getISTMidnight(date);
  // Day 0 of the next month === last day of this month.
  const lastDay = new Date(
    Date.UTC(label.getUTCFullYear(), label.getUTCMonth() + 1, 0)
  );
  return getISTEndOfDayLabel(lastDay);
}

/**
 * The day label for the Monday that starts the IST week containing `date`.
 * The app treats Monday as the first day of the week.
 */
export function getISTStartOfWeek(date: Date = new Date()): Date {
  return addDays(getISTMidnight(date), -getISTDayOfWeek(date));
}

/**
 * Due date for a WEEKLY goal created on `date`, under the "Weekend Rule":
 * goals land on the coming Sunday, but anything created on Sat or Sun rolls
 * to the Sunday of the *following* week so it isn't due immediately.
 */
export function getWeeklyGoalDueDate(date: Date = new Date()): Date {
  const dow = getISTDayOfWeek(date); // 0 = Mon .. 6 = Sun
  let daysUntilSunday = 6 - dow;
  if (dow >= 5) daysUntilSunday += 7; // created Sat (5) or Sun (6)
  return getISTEndOfDayLabel(addDays(getISTMidnight(date), daysUntilSunday));
}
