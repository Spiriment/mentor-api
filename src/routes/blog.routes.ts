import { Router } from 'express';
import { BlogController } from '../controllers/blog.controller';

const router = Router();

// Public routes
router.get('/admin', BlogController.getAllPostsAdmin); // Admin: all posts (drafts + published)
router.get('/', BlogController.getPublishedPosts);
router.get('/:slug', BlogController.getPostBySlug);


// Admin routes (would be protected by middleware in a real app)
router.post('/', BlogController.createPost);
router.put('/:id', BlogController.updatePost);
router.delete('/:id', BlogController.deletePost);

export const blogRoutes = router;
