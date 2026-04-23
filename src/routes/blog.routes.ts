import { Router } from 'express';
import { BlogController } from '../controllers/blog.controller';
import { uploadBlogImage } from '../middleware/upload.middleware';

const router = Router();

// Public routes
router.get('/admin', BlogController.getAllPostsAdmin); // Admin: all posts (drafts + published)
router.get('/', BlogController.getPublishedPosts);
router.get('/id/:id', BlogController.getPostById); // Add /id/ prefix to avoid collision with slug
router.get('/:slug', BlogController.getPostBySlug);

// Admin routes (would be protected by middleware in a real app)
router.post('/', BlogController.createPost);
router.put('/:id', BlogController.updatePost);
router.delete('/:id', BlogController.deletePost);
router.post('/upload-image', uploadBlogImage, BlogController.uploadImage);

export const blogRoutes = router;
