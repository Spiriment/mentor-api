import { Router } from 'express';
import { BibleService } from '@/services/bible.service';
import { BibleController } from '@/controllers/bible.controller';

const bibleService = new BibleService();
const bibleController = new BibleController(bibleService);

const bibleRoutes = Router();

// GET /api/bible/:book/:chapter
bibleRoutes.get('/:book/:chapter', bibleController.getChapter);

// GET /api/bible/passage?reference=John%203:16-18
bibleRoutes.get('/passage', bibleController.getPassage);

export { bibleRoutes };
