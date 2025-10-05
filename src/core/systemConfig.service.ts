import { DataSource } from "typeorm";
import { SystemConfig } from "@/database/entities/systemConfig.entity";
import { SystemConfigRepository } from "@/repository/system-config.repository";
import { AppError, NotFoundError } from "@/common";

export class SystemConfigService {
  private dataSource: DataSource;
  private systemConfigRepository: SystemConfigRepository;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.systemConfigRepository = new SystemConfigRepository(dataSource);
  }

  // Get the main app config
  async getMainConfig(): Promise<SystemConfig> {
    try {
      const config = await this.systemConfigRepository.findConfig();

      if (!config) {
        throw new NotFoundError("System configuration not found");
      }

      return config;
    } catch (error) {
      throw new AppError("Failed to get system configuration", 500);
    }
  }

  // Get system config (alias for getMainConfig)
  async getSystemConfig(): Promise<SystemConfig> {
    const config = await this.getMainConfig();
    return config;
  }

  // Initialize default config if not exists
  async initializeDefaultConfig(): Promise<SystemConfig> {
    try {
      // Check if config already exists
      const existingConfig = await this.systemConfigRepository.findConfig();

      if (existingConfig) {
        return existingConfig;
      }

      const defaultConfig = this.systemConfigRepository.create({
        id: "main_app_config",
        version: 1,
        featureToggles: {
          station_features: {
            add_product_fee: {
              enabled: true,
              description: "Enable product addition fees",
            },
            add_amenity_fee: {
              enabled: true,
              description: "Enable amenity addition fees",
            },
            tank_capacity_management: {
              enabled: true,
              description: "Enable tank capacity management",
            },
          },
          transaction_features: {
            withdrawal_charge: {
              enabled: true,
              description: "Enable withdrawal charges",
            },
            withdrawal_processing_cost: {
              enabled: true,
              description: "Enable withdrawal processing costs",
            },
            instant_wallet_charge: {
              enabled: true,
              description: "Enable instant wallet charges",
            },
            user_transaction_limit: {
              enabled: true,
              description: "Enable user transaction limits",
            },
            station_transaction_limit: {
              enabled: true,
              description: "Enable station transaction limits",
            },
          },
          referral_features: {
            user_referral_bonus: {
              enabled: true,
              description: "Enable user referral bonuses",
            },
            executive_User_referral_bonus: {
              enabled: true,
              description: "Enable executive User referral bonuses",
            },
            executive_User_associate_referral_bonus: {
              enabled: true,
              description: "Enable executive User associate referral bonuses",
            },
            associate_User_referral_bonus: {
              enabled: true,
              description: "Enable associate User referral bonuses",
            },
            station_manager_referral_bonus: {
              enabled: true,
              description: "Enable station manager referral bonuses",
            },
            pump_attendant_referral_bonus: {
              enabled: true,
              description: "Enable pump attendant referral bonuses",
            },
          },
        },
        stationSettings: {
          fees: {
            add_product: { amount: 1000, currency: "NGN" },
            add_amenity: { amount: 500, currency: "NGN" },
            description: "Station feature fees",
          },
          free_limits: {
            max_products: 5,
            max_amenities: 3,
            description: "Free limits for stations",
          },
          default_tank_capacity: {
            capacity: 50000,
            unit: "liters",
            description: "Default tank capacity",
          },
        },
        transactionSettings: {
          limits: {
            user: { amount: 100000, currency: "NGN" },
            station: { amount: 1000000, currency: "NGN" },
          },
          wallet: {
            instant_charge: { amount: 100, currency: "NGN" },
          },
          withdrawal: {
            charge: { amount: 200, currency: "NGN" },
            processing_cost: { amount: 50, currency: "NGN" },
          },
        },
        referralBonus: {
          user: {
            transaction_bonus: {
              percentage: 2,
              cap_amount: { amount: 1000, currency: "NGN" },
              description: "Percentage bonus on user fuel purchases",
            },
            one_time_amount: { amount: 500, currency: "NGN" },
            description: "One-time bonus for user registration",
          },
          executive_User: {
            percentage: 3,
            cap_amount: { amount: 2000, currency: "NGN" },
            description: "Executive User referral bonus",
          },
          executive_User_associate: {
            percentage: 2.5,
            cap_amount: { amount: 1500, currency: "NGN" },
            description: "Executive User associate referral bonus",
          },
          associate_User: {
            percentage: 2,
            cap_amount: { amount: 1000, currency: "NGN" },
            description: "Associate User referral bonus",
          },
          station_manager: {
            percentage: 1.5,
            cap_amount: { amount: 800, currency: "NGN" },
            description: "Station manager referral bonus",
          },
          pump_attendant: {
            percentage: 1,
            cap_amount: { amount: 500, currency: "NGN" },
            description: "Pump attendant referral bonus",
          },
        },
        metadata: {
          created_by: "system",
          updated_by: "system",
          base_currency: "NGN",
          currency_symbol: "₦",
        },
      });

      const savedConfig = await this.systemConfigRepository.save(defaultConfig);

      return savedConfig;
    } catch (error) {
      console.error("Error initializing system configuration:", error);
      throw new AppError("Failed to initialize system configuration", 500);
    }
  }

  // Update system config
  async updateConfig(
    updates: Partial<SystemConfig>,
    updatedBy: string
  ): Promise<SystemConfig> {
    try {
      const config = await this.systemConfigRepository.findConfig();

      if (!config) {
        throw new NotFoundError("System configuration not found");
      }

      // Update version and metadata
      updates.version = config.version + 1;
      updates.metadata = {
        ...config.metadata,
        updated_by: updatedBy,
      };

      const updatedConfig = await this.systemConfigRepository.save({
        ...config,
        ...updates,
      });

      return updatedConfig;
    } catch (error) {
      throw new AppError("Failed to update system configuration", 500);
    }
  }

  // Get referral bonus configuration
  async getReferralBonusConfig(): Promise<{
    referralBonus: any;
    featureToggles: any;
  }> {
    try {
      const config = await this.getMainConfig();

      return {
        referralBonus: config.referralBonus,
        featureToggles: config.featureToggles.referral_features,
      };
    } catch (error) {
      throw new AppError("Failed to get referral bonus configuration", 500);
    }
  }

  // Check if referral feature is enabled
  async isReferralFeatureEnabled(feature: string): Promise<boolean> {
    try {
      const config = await this.getMainConfig();

      const featureToggles = config.featureToggles.referral_features;
      return (
        featureToggles[feature as keyof typeof featureToggles]?.enabled || false
      );
    } catch (error) {
      return false;
    }
  }
}
