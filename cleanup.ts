import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  console.log('Deleting DayDebrief...');
  await prisma.dayDebrief.deleteMany();

  console.log('Deleting DailyScheduleSlot...');
  await prisma.dailyScheduleSlot.deleteMany();

  console.log('Deleting BlockSessionLog...');
  await prisma.blockSessionLog.deleteMany();

  console.log('Deleting DailyHistory...');
  await prisma.dailyHistory.deleteMany();

  console.log('Deleting Habit...');
  await prisma.habit.deleteMany();

  console.log('Deleting SubjectStreak...');
  await prisma.subjectStreak.deleteMany();

  console.log('Deleting ActivityLog...');
  await prisma.activityLog.deleteMany();

  console.log('Deleting Revision...');
  await prisma.revision.deleteMany();

  console.log('Deleting TopicCaptureLink...');
  await prisma.topicCaptureLink.deleteMany();

  console.log('Deleting TopicMention...');
  await prisma.topicMention.deleteMany();

  console.log('Deleting Topic...');
  await prisma.topic.deleteMany();

  console.log('Deleting Tag...');
  await prisma.tag.deleteMany();

  console.log('Deleting Attachment...');
  await prisma.attachment.deleteMany();

  console.log('Deleting Reminder...');
  await prisma.reminder.deleteMany();

  console.log('Deleting Capture...');
  await prisma.capture.deleteMany();

  console.log('Deleting NoteCategory...');
  await prisma.noteCategory.deleteMany();

  console.log('Deleting Subject...');
  await prisma.subject.deleteMany();

  console.log('All requested tables emptied successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
