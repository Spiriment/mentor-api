import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("audit_logs")
export class AuditLog extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  userType: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  ip: string;

  @CreateDateColumn()
  timestamp: Date;
}
