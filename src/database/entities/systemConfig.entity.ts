import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @PrimaryColumn({ default: 'main_app_config' })
  id!: string;

  @Column()
  version!: number;

  @Column({ type: 'json' })
  featureToggles!: {
    station_features: {
      add_product_fee: { enabled: boolean; description: string };
      add_amenity_fee: { enabled: boolean; description: string };
      tank_capacity_management: { enabled: boolean; description: string };
    };
    transaction_features: {
      withdrawal_charge: { enabled: boolean; description: string };
      withdrawal_processing_cost: { enabled: boolean; description: string };
      instant_wallet_charge: { enabled: boolean; description: string };
      user_transaction_limit: { enabled: boolean; description: string };
      station_transaction_limit: { enabled: boolean; description: string };
    };
    referral_features: {
      user_referral_bonus: { enabled: boolean; description: string };
      executive_User_referral_bonus: { enabled: boolean; description: string };
      executive_User_associate_referral_bonus: {
        enabled: boolean;
        description: string;
      };
      associate_User_referral_bonus: { enabled: boolean; description: string };
      station_manager_referral_bonus: { enabled: boolean; description: string };
      pump_attendant_referral_bonus: { enabled: boolean; description: string };
    };
  };

  @Column({ type: 'json' })
  stationSettings!: {
    fees: {
      add_product: { amount: number; currency: string };
      add_amenity: { amount: number; currency: string };
      description: string;
    };
    free_limits: {
      max_products: number;
      max_amenities: number;
      description: string;
    };
    default_tank_capacity: {
      capacity: number;
      unit: string;
      description: string;
    };
  };

  @Column({ type: 'json' })
  transactionSettings!: {
    limits: {
      user: { amount: number; currency: string };
      station: { amount: number; currency: string };
    };
    wallet: {
      instant_charge: { amount: number; currency: string };
    };
    withdrawal: {
      charge: { amount: number; currency: string };
      processing_cost: { amount: number; currency: string };
    };
  };

  @Column({ type: 'json' })
  referralBonus!: {
    user: {
      transaction_bonus: {
        percentage: number;
        cap_amount: { amount: number; currency: string };
        description: string;
      };
      one_time_amount: { amount: number; currency: string };
      description: string;
    };
    executive_User: {
      percentage: number;
      cap_amount: { amount: number; currency: string };
      description: string;
    };
    executive_User_associate: {
      percentage: number;
      cap_amount: { amount: number; currency: string };
      description: string;
    };
    associate_User: {
      percentage: number;
      cap_amount: { amount: number; currency: string };
      description: string;
    };
    station_manager: {
      percentage: number;
      cap_amount: { amount: number; currency: string };
      description: string;
    };
    pump_attendant: {
      percentage: number;
      cap_amount: { amount: number; currency: string };
      description: string;
    };
  };

  @Column({ type: 'json' })
  metadata!: {
    created_by: string;
    updated_by: string;
    base_currency: string;
    currency_symbol: string;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
