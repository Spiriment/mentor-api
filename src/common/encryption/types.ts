export interface EncryptionConfig {
  algorithm: string;
  key: string;
  iv?: string;
}

export interface HashingConfig {
  algorithm: 'sha256' | 'sha512' | 'blake2b512';
  salt?: string;
  iterations?: number;
}

export interface EncryptionService {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
  generateKey(): Promise<string>;
  generateIV(): Promise<string>;
  hash(data: string, config?: HashingConfig): Promise<string>;
  verifyHash(data: string, hash: string, config?: HashingConfig): Promise<boolean>;
  generateSalt(): Promise<string>;
}
