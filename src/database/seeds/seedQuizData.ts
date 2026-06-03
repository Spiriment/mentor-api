/**
 * Run once to seed quiz_books and quiz_questions from the static app data.
 * Usage: npx ts-node -r tsconfig-paths/register src/database/seeds/seedQuizData.ts
 */
import 'reflect-metadata';
import { AppDataSource } from '@/config/data-source';
import { QuizBook } from '@/database/entities/quizBook.entity';
import { QuizQuestion } from '@/database/entities/quizQuestion.entity';
import { v4 as uuidv4 } from 'uuid';

const OLD_TESTAMENT = new Set([
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
  'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs',
  'Ecclesiastes','Songs of Solomon','Isaiah','Jeremiah','Lamentations',
  'Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah',
  'Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
]);

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  // Dynamically load the static data (it lives in the mobile app, copy path as needed)
  // We inline a minimal loader here — point to wherever the file is accessible
  // Quiz data is bundled as JSON alongside this seed script
  const BIBLE_QUIZ_DATA: any[] = require('./quizData.json');

  const bookRepo = AppDataSource.getRepository(QuizBook);
  const questionRepo = AppDataSource.getRepository(QuizQuestion);

  let booksCreated = 0;
  let questionsCreated = 0;

  for (let sortOrder = 0; sortOrder < BIBLE_QUIZ_DATA.length; sortOrder++) {
    const entry = BIBLE_QUIZ_DATA[sortOrder];
    const bookName: string = entry.book;
    const category = OLD_TESTAMENT.has(bookName) ? 'OT' : 'NT';

    let book = await bookRepo.findOne({ where: { book: bookName } });
    if (!book) {
      book = bookRepo.create({
        id: uuidv4(),
        book: bookName,
        category: category as 'OT' | 'NT',
        isActive: true,
        sortOrder,
      });
      await bookRepo.save(book);
      booksCreated++;
    }

    for (const versionEntry of entry.versions) {
      const version: number = versionEntry.version;
      // Delete existing questions for this book+version to avoid dupes on re-run
      await questionRepo.delete({ bookId: book.id, version });

      const questions = versionEntry.questions.map((q: any, idx: number) =>
        questionRepo.create({
          id: uuidv4(),
          bookId: book!.id,
          version,
          questionNumber: idx + 1,
          question: q.question,
          options: q.options,
          answer: q.answer,
          verse: q.verse ?? null,
          isActive: true,
        })
      );

      await questionRepo.save(questions);
      questionsCreated += questions.length;
    }
  }

  console.log(`Seeded ${booksCreated} books, ${questionsCreated} questions`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
