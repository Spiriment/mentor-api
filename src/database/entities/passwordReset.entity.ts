import { RoleEnum } from "@/common/auth/rbac";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class PasswordReset {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  token: string;

  @Column()
  userId: string;

  @Column({ type: "enum", enum: RoleEnum })
  userType: RoleEnum;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;
}
