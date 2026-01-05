import { Router } from 'express';
import { BibleUserController } from '@/controllers/bibleUser.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const controller = new BibleUserController();
const bibleUserRoutes = Router();

bibleUserRoutes.use(authenticateToken);

// Bookmarks
bibleUserRoutes.get('/bookmarks/books', controller.getBookmarkBooks);
bibleUserRoutes.get('/bookmarks', controller.getBookmarks);
bibleUserRoutes.post('/bookmarks', controller.addBookmark);
bibleUserRoutes.delete('/bookmarks/:id', controller.deleteBookmark);

// Highlights
bibleUserRoutes.get('/highlights', controller.getHighlights);
bibleUserRoutes.post('/highlights', controller.addHighlight);

// Reflections
bibleUserRoutes.get('/reflections', controller.getReflections);
bibleUserRoutes.post('/reflections', controller.addReflection);

// Progress
bibleUserRoutes.get('/progress/:plan', controller.getProgress);
bibleUserRoutes.put('/progress/:plan', controller.updateProgress);

export { bibleUserRoutes };
