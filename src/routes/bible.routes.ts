import { Router } from 'express';
import { BibleService } from '@/services/bible.service';
import { BibleController } from '@/controllers/bible.controller';

const bibleService = new BibleService();
const bibleController = new BibleController(bibleService);

const bibleRoutes = Router();

// GET /api/bible/languages - Get available languages
bibleRoutes.get('/languages', bibleController.getAvailableLanguages);

// GET /api/bible/:book/:chapter?lang=eng|deu|nld - Get chapter with optional language
bibleRoutes.get('/:book/:chapter', bibleController.getChapter);

// GET /api/bible/passage?reference=John%203:16-18&lang=eng|deu|nld - Get passage with optional language
bibleRoutes.get('/passage', bibleController.getPassage);

export { bibleRoutes };
