import { Request, Response } from 'express';
import { BlogService } from '../services/blog.service';
import { AppDataSource } from '../config/data-source';
import { createBlogSchema, updateBlogSchema } from '../validation/blog.dto';

export const BlogController = {
  async getPublishedPosts(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const blogService = new BlogService(AppDataSource);
      const data = await blogService.getAllPublishedPosts(page, limit);
      
      return res.status(200).json({
        success: true,
        response: {
          posts: data.posts,
          pagination: { total: data.total, page, limit }
        }
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async getPostBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const blogService = new BlogService(AppDataSource);
      const post = await blogService.getPostBySlug(slug);
      
      if (!post) {
        return res.status(404).json({ status: 'error', message: 'Post not found' });
      }
      
      return res.status(200).json({ success: true, response: post });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async createPost(req: Request, res: Response) {
    try {
      const parsedData = createBlogSchema.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({ status: 'error', errors: parsedData.error.format() });
      }
      
      const authorId = (req as any).user?.id; // Assuming auth middleware sets req.user
      const blogService = new BlogService(AppDataSource);
      const post = await blogService.createPost(parsedData.data, authorId);
      
      return res.status(201).json({ success: true, response: post });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async updatePost(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parsedData = updateBlogSchema.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({ status: 'error', errors: parsedData.error.format() });
      }
      
      const blogService = new BlogService(AppDataSource);
      const post = await blogService.updatePost(id, parsedData.data);
      
      if (!post) {
        return res.status(404).json({ status: 'error', message: 'Post not found' });
      }
      
      return res.status(200).json({ success: true, response: post });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async deletePost(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const blogService = new BlogService(AppDataSource);
      const success = await blogService.deletePost(id);
      
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Post not found' });
      }
      
      return res.status(200).json({ success: true, response: { message: 'Post deleted' } });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },
  async getAllPostsAdmin(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const blogService = new BlogService(AppDataSource);
      const data = await blogService.getAllPostsAdmin(page, limit);
      return res.status(200).json({
        success: true,
        response: {
          posts: data.posts,
          pagination: { total: data.total, page, limit },
        },
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },
};
