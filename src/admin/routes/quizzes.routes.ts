import { Router } from 'express';
import {
  adminGetBooks,
  adminGetBook,
  adminCreateBook,
  adminUpdateBook,
  adminDeleteBook,
  adminCreateQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminBulkImport,
} from '@/admin/controllers/quiz.admin.controller';

const router = Router();

// Books
router.get('/books', adminGetBooks);
router.post('/books', adminCreateBook);
router.get('/books/:bookId', adminGetBook);
router.put('/books/:bookId', adminUpdateBook);
router.delete('/books/:bookId', adminDeleteBook);

// Questions
router.post('/books/:bookId/questions', adminCreateQuestion);
router.post('/books/:bookId/bulk-import', adminBulkImport);
router.put('/questions/:questionId', adminUpdateQuestion);
router.delete('/questions/:questionId', adminDeleteQuestion);

export default router;
