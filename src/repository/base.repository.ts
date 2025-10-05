import {
  Repository,
  FindOptionsWhere,
  EntityTarget,
  DataSource,
  ObjectLiteral,
  DeepPartial,
  SaveOptions,
  FindOneOptions,
  FindManyOptions,
  UpdateResult,
  UpdateOptions,
  DeleteResult,
} from "typeorm";
import { FilterOptions, PaginatedResponse } from "../common/types";
import { RedisClient } from "../common";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

export class BaseRepository<T extends ObjectLiteral> extends Repository<T> {
  private readonly redis?: RedisClient;
  cacheTTL: number = 3600;
  private readonly cachePrefix: string;

  cacheKeys: any = {
    findById: (id: string | number) => `findById:${id}`,
    findByIds: (ids: (string | number)[]) => `findByIds:${ids.join(",")}`,
    findPaginated: (options: FindManyOptions<T>, page = 1, limit = 10) =>
      `findPaginated:${JSON.stringify(options)}:${page}:${limit}`,
  };

  constructor(
    entity: EntityTarget<T>,
    dataSource: DataSource,
    redis?: RedisClient
  ) {
    super(entity, dataSource.createEntityManager());
    this.redis = redis;
    this.cachePrefix = this.metadata.tableName;
  }

  private getCacheKey(key: string): string {
    return `${this.cachePrefix}:${key}`;
  }

  private async getFromCache<R>(key: string): Promise<R | null> {
    if (!this.redis) return null;
    const cached = await this.redis.get<R>(this.getCacheKey(key));
    return cached;
  }

  private async setCache<R>(key: string, data: R): Promise<void> {
    await this.redis?.set(this.getCacheKey(key), data, {
      ttl: this.cacheTTL,
    });
  }

  async cache<R>(key: string, data: R): Promise<void> {
    await this.setCache(key, data);
  }

  private async invalidateCache(pattern: string = "*"): Promise<void> {
    const keys = await this.redis?.keys(this.getCacheKey(pattern));
    if (keys && keys.length > 0) {
      await this.redis?.del(keys[0]);
    }
  }

  async findById(
    id: string | number,
    options: FindOneOptions<T> = {}
  ): Promise<T | null> {
    const cacheKey = this.cacheKeys.findById(id);

    const cached = await this.getFromCache<T>(cacheKey);

    if (cached) return cached;

    const result = await this.findOne({
      ...options,
      where: { id } as unknown as FindOptionsWhere<T>,
    });

    if (result) {
      await this.setCache(cacheKey, result);
    }

    return result || null;
  }

  async findByIds(
    ids: (string | number)[],
    options: FindManyOptions<T> = {}
  ): Promise<T[]> {
    const cacheKey = this.cacheKeys.findByIds(ids);
    const cached = await this.getFromCache<T[]>(cacheKey);

    if (cached) return cached;

    const results = await this.find({
      ...options,
      where: { id: { $in: ids } } as unknown as FindOptionsWhere<T>,
    });

    await this.setCache(cacheKey, results);
    return results;
  }

  async findPaginated({
    options = {},
    page = 1,
    limit = 10,
    order = { createdAt: "DESC" },
  }: FilterOptions<T>): Promise<PaginatedResponse<T>> {
    const [data, total] = await this.findAndCount({
      ...options,
      skip: (page - 1) * limit,
      take: limit,
      order,
    });

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
    return result;
  }

  override async save<E extends DeepPartial<T>>(
    entity: E,
    options?: SaveOptions
  ): Promise<E & T> {
    const result = await super.save(entity, options);
    await this.setCache(this.cacheKeys.findById(result.id), result);
    await this.invalidateCache();
    return result;
  }

  override async update(
    id: string | number,
    entity: QueryDeepPartialEntity<T>
  ): Promise<UpdateResult> {
    const result = await super.update(id, entity);

    await this.setCache(this.cacheKeys.findById(id), result);
    await this.invalidateCache();
    return result;
  }

  async updateEntity(id: any, entity: Partial<T>): Promise<T | null> {
    const existingEntity = await this.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (!existingEntity) {
      return null;
    }

    Object.assign(existingEntity, entity);
    return await this.save(existingEntity);
  }

  override async delete(id: string | number): Promise<any> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new Error(`Entity with id ${id} not found`);
    }
    const result = await super.softRemove(entity);
    await this.invalidateCache();
    return result;
  }

  async saveMany<E extends DeepPartial<T>>(
    entities: E[],
    options?: SaveOptions
  ): Promise<(E & T)[]> {
    const result = await super.save(entities, options);
    await this.invalidateCache();
    return result;
  }

  protected getAlias(): string {
    return this.metadata.tableName;
  }
}
