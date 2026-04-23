import { DataSource, Repository } from 'typeorm';
import { BlogPost } from '../database/entities/blogPost.entity';
import { CreateBlogDTO, UpdateBlogDTO } from '../validation/blog.dto';

export class BlogService {
  private blogRepo: Repository<BlogPost>;

  constructor(private readonly dataSource: DataSource) {
    this.blogRepo = this.dataSource.getRepository(BlogPost);
  }

  async createPost(data: CreateBlogDTO, authorId?: string): Promise<BlogPost> {
    const newPost = this.blogRepo.create({
      ...data,
      authorId,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
    });
    return this.blogRepo.save(newPost);
  }

  async updatePost(id: string, data: UpdateBlogDTO): Promise<BlogPost | null> {
    const post = await this.blogRepo.findOne({ where: { id } });
    if (!post) return null;

    Object.assign(post, {
      ...data,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : post.publishedAt,
    });
    return this.blogRepo.save(post);
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await this.blogRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    return this.blogRepo.findOne({ where: { slug, isPublished: true }, relations: ['author'] });
  }

  async getPostById(id: string): Promise<BlogPost | null> {
    return this.blogRepo.findOne({ where: { id }, relations: ['author'] });
  }

  async getAllPublishedPosts(page = 1, limit = 10): Promise<{ posts: BlogPost[], total: number }> {
    const [posts, total] = await this.blogRepo.findAndCount({
      where: { isPublished: true },
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['author'],
    });
    return { posts, total };
  }

  async getAllPostsAdmin(page = 1, limit = 20): Promise<{ posts: BlogPost[], total: number }> {
    const [posts, total] = await this.blogRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['author'],
    });
    return { posts, total };
  }
}
