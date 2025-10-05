import { SystemConfig } from "@/database/entities";
import { BaseRepository } from "@/repository/base.repository";
import { ServiceResponse } from "@/common/types";
import { RedisClient } from "@/common";
import { DataSource } from "typeorm";

export class SystemConfigRepository extends BaseRepository<SystemConfig> {
  constructor(dataSource: DataSource, redis?: RedisClient) {
    super(SystemConfig, dataSource, redis);
  }

  async findConfig(): Promise<SystemConfig | null> {
    try {
      const systemConfig = await this.findById("main_app_config");
      return systemConfig;
    } catch (error) {
      return null;
    }
  }
}
