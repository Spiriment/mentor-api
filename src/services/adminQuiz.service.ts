import { AppDataSource } from '@/config/data-source';
import { Session } from '@/database/entities/session.entity';

// Static quiz catalog — 66 Bible books, each with version(s) and question counts.
// Update this if new quiz content is added to the app's bibleQuiz.ts.
export const QUIZ_CATALOG = [
  { book: 'Genesis', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Exodus', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Leviticus', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Numbers', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Deuteronomy', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Joshua', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Judges', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Ruth', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 Samuel', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Samuel', versions: [{ version: 1, questionCount: 40 }] },
  { book: '1 Kings', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Kings', versions: [{ version: 1, questionCount: 40 }] },
  { book: '1 Chronicles', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Chronicles', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Ezra', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Nehemiah', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Esther', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Job', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Psalms', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Proverbs', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Ecclesiastes', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Song of Solomon', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Isaiah', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Jeremiah', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Lamentations', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Ezekiel', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Daniel', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Hosea', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Joel', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Amos', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Obadiah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Jonah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Micah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Nahum', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Habakkuk', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Zephaniah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Haggai', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Zechariah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Malachi', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Matthew', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Mark', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Luke', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'John', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Acts', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Romans', versions: [{ version: 1, questionCount: 40 }] },
  { book: '1 Corinthians', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Corinthians', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Galatians', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Ephesians', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Philippians', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Colossians', versions: [{ version: 1, questionCount: 10 }, { version: 2, questionCount: 39 }] },
  { book: '1 Thessalonians', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 Thessalonians', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 Timothy', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 Timothy', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Titus', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Philemon', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Hebrews', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'James', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 Peter', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 Peter', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 John', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 John', versions: [{ version: 1, questionCount: 10 }] },
  { book: '3 John', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Jude', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Revelation', versions: [{ version: 1, questionCount: 40 }] },
];

export class AdminQuizService {
  getCatalog() {
    const catalog = QUIZ_CATALOG.map(b => ({
      book: b.book,
      versionCount: b.versions.length,
      totalQuestions: b.versions.reduce((s, v) => s + v.questionCount, 0),
      versions: b.versions,
    }));

    const totalBooks = catalog.length;
    const totalVersions = catalog.reduce((s, b) => s + b.versionCount, 0);
    const totalQuestions = catalog.reduce((s, b) => s + b.totalQuestions, 0);

    return { catalog, summary: { totalBooks, totalVersions, totalQuestions } };
  }

  async getQuizStats() {
    // Future: join with any quiz_attempt entity if one is added.
    // For now return catalog + zero-fill for attempt stats.
    return this.getCatalog();
  }
}

export const adminQuizService = new AdminQuizService();
