import { DataSource, Repository } from 'typeorm';
import { Faq } from '../database/entities/faq.entity';
import { CreateFaqDTO, UpdateFaqDTO } from '../validation/faq.dto';

export class FaqService {
  private faqRepo: Repository<Faq>;

  constructor(private readonly dataSource: DataSource) {
    this.faqRepo = this.dataSource.getRepository(Faq);
  }

  async create(data: CreateFaqDTO): Promise<Faq> {
    const faq = this.faqRepo.create(data);
    return this.faqRepo.save(faq);
  }

  async update(id: string, data: UpdateFaqDTO): Promise<Faq | null> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) return null;
    Object.assign(faq, data);
    return this.faqRepo.save(faq);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.faqRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getAll(): Promise<Faq[]> {
    return this.faqRepo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async getPublished(): Promise<Faq[]> {
    return this.faqRepo.find({ where: { isPublished: true }, order: { sortOrder: 'ASC' } });
  }
}
