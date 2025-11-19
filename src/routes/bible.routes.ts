import { Router } from 'express';
import { BibleService } from '@/services/bible.service';
import { BibleController } from '@/controllers/bible.controller';

const bibleService = new BibleService();
const bibleController = new BibleController(bibleService);

const bibleRoutes = Router();

// IMPORTANT: Register specific routes BEFORE parameterized routes
// GET /api/bible/languages - Get available languages
bibleRoutes.get('/languages', bibleController.getAvailableLanguages);

// GET /api/bible/passage?reference=John%203:16-18&lang=eng|deu|nld - Get passage with optional language
bibleRoutes.get('/passage', bibleController.getPassage);

// Middleware to reject reserved paths that should be handled by other routes
bibleRoutes.use('/:book/:chapter', (req, res, next) => {
  const { book } = req.params;
  // Reject reserved words that should be handled by other routes
  if (book === 'user' || book === 'languages' || book === 'passage') {
    return res.status(404).json({
      success: false,
      error: { 
        message: `Route not found. "${book}" is a reserved path.`, 
        code: 'ROUTE_NOT_FOUND' 
      }
    });
  }
  next();
});

// GET /api/bible/:book/:chapter?lang=eng|deu|nld - Get chapter with optional language
// This must be LAST to avoid matching /user/* routes
bibleRoutes.get('/:book/:chapter', bibleController.getChapter);

export { bibleRoutes };
