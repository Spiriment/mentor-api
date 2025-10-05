import { Entity, Column } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("refresh_tokens")
export class RefreshToken extends BaseEntity {
  @Column({ unique: true })
  token: string;

  @Column()
  userId: string;

  @Column()
  userType: string;

  @Column()
  expiresAt: Date;
}
