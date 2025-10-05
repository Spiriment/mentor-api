import { Config } from "@/common";
import { Logger } from "@/common/logger";
import { AppError } from "@/common/errors";

export interface UploadResult {
  public_id: string;
  url: string;
  secure_url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

export interface UploadOptions {
  folder?: string;
  transformation?: any;
  allowedFormats?: string[];
  maxSize?: number;
  quality?: number;
  format?: string;
}

export class FileUploadService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      level: process.env.LOG_LEVEL as any,
      service: "file-upload-service",
    });
  }

  /**
   * Upload file from base64 string
   */
  async uploadBase64(
    base64String: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      if (!this.isValidBase64(base64String)) {
        throw new AppError("Invalid base64 string");
      }

      const format = this.extractFormatFromBase64(base64String);

      if (options.allowedFormats && !options.allowedFormats.includes(format)) {
        throw new AppError(
          `Format ${format} is not allowed. Allowed formats: ${options.allowedFormats.join(
            ", "
          )}`
        );
      }

      const fileSize = this.getBase64FileSize(base64String);
      if (options.maxSize && fileSize > options.maxSize) {
        throw new AppError(
          `File size ${fileSize} bytes exceeds maximum allowed size ${options.maxSize} bytes`
        );
      }

      const uploadOptions: any = {
        folder: options.folder || "aptfuel",
        resource_type: "auto",
        quality: options.quality || "auto",
      };

      if (options.transformation) {
        uploadOptions.transformation = options.transformation;
      }

      if (options.format) {
        uploadOptions.format = options.format;
      }

      const result = await this.uploadBase64(base64String, uploadOptions);

      this.logger.info("File uploaded successfully", {
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        folder: options.folder,
      });

      return {
        public_id: result.public_id,
        url: result.url,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error: any) {
      this.logger.error("Failed to upload file", error);
      throw new AppError(`Upload failed: ${error.message}`, error);
    }
  }

  /**
   * Upload file from buffer
   */
  async uploadBuffer(
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      if (options.maxSize && buffer.length > options.maxSize) {
        throw new AppError(
          `File size ${buffer.length} bytes exceeds maximum allowed size ${options.maxSize} bytes`
        );
      }

      const uploadOptions: any = {
        folder: `aptfuel/${Config.nodeEnv}/${options.folder}`,
        resource_type: "auto",
        quality: options.quality || "auto",
      };

      if (options.transformation) {
        uploadOptions.transformation = options.transformation;
      }

      if (options.format) {
        uploadOptions.format = options.format;
      }

      const result = await new Promise<any>((resolve, reject) => {});

      this.logger.info("File uploaded successfully", {
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        folder: options.folder,
      });

      return {
        public_id: result.public_id,
        url: result.url,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error: any) {
      this.logger.error("Failed to upload file", error);
      throw new AppError(`Upload failed: ${error.message}`, error);
    }
  }

  /**
   * Validate base64 string
   */
  private isValidBase64(str: string): boolean {
    try {
      if (str.startsWith("data:")) {
        const matches = str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        return matches !== null && matches.length === 3;
      }

      return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    } catch {
      return false;
    }
  }

  /**
   * Extract format from base64 data URL
   */
  private extractFormatFromBase64(base64String: string): string {
    if (base64String.startsWith("data:")) {
      const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[1]) {
        const mimeType = matches[1];
        const format = mimeType.split("/")[1];
        return format || "unknown";
      }
    }
    return "unknown";
  }

  /**
   * Get file size from base64 string
   */
  private getBase64FileSize(base64String: string): number {
    try {
      if (base64String.startsWith("data:")) {
        const matches = base64String.match(
          /^data:([A-Za-z-+\/]+);base64,(.+)$/
        );
        if (matches && matches[2]) {
          return Buffer.byteLength(matches[2], "base64");
        }
      }
      return Buffer.byteLength(base64String, "base64");
    } catch {
      return 0;
    }
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
