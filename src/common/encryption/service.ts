import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  createHash,
  pbkdf2Sync,
} from "crypto";
import { promisify } from "util";
import { EncryptionConfig, EncryptionService, HashingConfig } from "./types";

const scryptAsync = promisify(scrypt);

export class EncryptionServiceImpl implements EncryptionService {
  private readonly algorithm: string;
  private readonly key: Buffer;
  private readonly iv?: Buffer;

  constructor(config: EncryptionConfig) {
    this.algorithm = config.algorithm;

    try {
      this.key = Buffer.from(config.key, "hex");
      if (this.key.length !== 32) {
        throw new Error(
          `Invalid key length: expected 32 bytes, got ${this.key.length} bytes`
        );
      }
    } catch (error) {
      throw new Error(
        `Invalid encryption key: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (config.iv) {
      try {
        this.iv = Buffer.from(config.iv, "hex");
        if (this.iv.length !== 16) {
          throw new Error(
            `Invalid IV length: expected 16 bytes, got ${this.iv.length} bytes`
          );
        }
      } catch (error) {
        throw new Error(
          `Invalid initialization vector: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  async encrypt(data: string): Promise<string> {
    try {
      const iv = this.iv || randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.key, iv);

      const encrypted = Buffer.concat([
        cipher.update(data, "utf8"),
        cipher.final(),
      ]);

      // If using a random IV, prepend it to the encrypted data
      if (!this.iv) {
        return Buffer.concat([iv, encrypted]).toString("base64");
      }

      return encrypted.toString("base64");
    } catch (error) {
      throw new Error(
        `Encryption failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async decrypt(encryptedData: string): Promise<string> {
    try {
      const encryptedBuffer = Buffer.from(encryptedData, "base64");
      let iv: Buffer;
      let encrypted: Buffer;

      if (!this.iv) {
        // Extract IV from the beginning of the encrypted data
        iv = encryptedBuffer.subarray(0, 16);
        encrypted = encryptedBuffer.subarray(16);
      } else {
        iv = this.iv;
        encrypted = encryptedBuffer;
      }

      const decipher = createDecipheriv(this.algorithm, this.key, iv);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString("utf8");
    } catch (error) {
      throw new Error(
        `Decryption failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async generateKey(): Promise<string> {
    try {
      const salt = randomBytes(16);
      const key = (await scryptAsync(
        "your-secret-password",
        salt,
        32
      )) as Buffer;
      return key.toString("hex");
    } catch (error) {
      throw new Error(
        `Key generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async generateIV(): Promise<string> {
    try {
      return randomBytes(16).toString("hex");
    } catch (error) {
      throw new Error(
        `IV generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async hash(data: string, config?: HashingConfig): Promise<string> {
    try {
      const defaultConfig: HashingConfig = {
        algorithm: "sha256",
        iterations: 10000,
      };

      const finalConfig = { ...defaultConfig, ...config };
      const salt = finalConfig.salt || (await this.generateSalt());

      if (finalConfig.algorithm === "blake2b512") {
        const hash = createHash("blake2b512");
        hash.update(data + salt);
        return `${salt}:${hash.digest("hex")}`;
      }

      // For SHA algorithms, use PBKDF2 for better security
      const hash = pbkdf2Sync(
        data,
        salt,
        finalConfig.iterations || 10000,
        64,
        finalConfig.algorithm
      );

      return `${salt}:${hash.toString("hex")}`;
    } catch (error) {
      throw new Error(
        `Hashing failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async verifyHash(
    data: string,
    hash: string,
    config?: HashingConfig
  ): Promise<boolean> {
    try {
      const [salt, storedHash] = hash.split(":");
      const computedHash = await this.hash(data, {
        ...config,
        salt,
        algorithm: config?.algorithm || "sha256",
      });
      const [, computedHashValue] = computedHash.split(":");

      return storedHash === computedHashValue;
    } catch (error) {
      throw new Error(
        `Hash verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async generateSalt(): Promise<string> {
    try {
      return randomBytes(16).toString("hex");
    } catch (error) {
      throw new Error(
        `Salt generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
