import jwt, { SignOptions } from "jsonwebtoken";
import {
  UserPayload,
  DecodedToken,
  ADMIN_JWT_TYP,
  ADMIN_REFRESH_JWT_TYP,
  AdminAccessJwtPayload,
  AdminRefreshJwtPayload,
  DecodedAdminAccessToken,
  DecodedAdminRefreshToken,
} from "../types";
import { UnauthorizedError } from "../errors";

export class JwtService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly expiresIn: string;

  constructor(privateKey: string, publicKey: string, expiresIn: string = "1h") {
    this.privateKey = this.normalizeKey(privateKey);
    this.publicKey = this.normalizeKey(publicKey);
    this.expiresIn = expiresIn;

    this.validateKeys();
  }

  private normalizeKey(key: string): string {
    return key.replace(/\\n/g, "\n").replace(/"/g, "").trim();
  }

  private validateKeys(): void {
    try {
      const testPayload = {
        test: true,
        exp: Math.floor(Date.now() / 1000) + 60,
      };
      const testToken = jwt.sign(testPayload, this.privateKey, {
        algorithm: "RS256",
      });
      jwt.verify(testToken, this.publicKey, { algorithms: ["RS256"] });
    } catch (error) {
      console.error("JWT Key validation failed:", error);
      throw new Error(
        "Invalid JWT keys provided. Please check your private and public keys."
      );
    }
  }

  sign<T extends UserPayload>(payload: T): string {
    try {
      const options: SignOptions & { algorithm: "RS256" } = {
        algorithm: "RS256",
        expiresIn: this.expiresIn as jwt.SignOptions["expiresIn"],
      };
      return jwt.sign(payload, this.privateKey, options);
    } catch (error) {
      console.error("JWT Sign error:", error);
      throw new UnauthorizedError("Failed to sign JWT token");
    }
  }

  verify<T extends UserPayload>(token: string): DecodedToken<T> {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ["RS256"],
      }) as DecodedToken<T>;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token has expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log("Invalid token", { error });
        throw new UnauthorizedError("Invalid token");
      } else {
        throw new UnauthorizedError("Failed to verify token");
      }
    }
  }

  signAdminAccessToken(
    payload: Omit<AdminAccessJwtPayload, "typ">,
    expiresIn: string
  ): string {
    const full: AdminAccessJwtPayload = { ...payload, typ: ADMIN_JWT_TYP };
    try {
      const options: SignOptions & { algorithm: "RS256" } = {
        algorithm: "RS256",
        expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
      };
      return jwt.sign(full, this.privateKey, options);
    } catch (error) {
      console.error("JWT Admin sign error:", error);
      throw new UnauthorizedError("Failed to sign admin token");
    }
  }

  signAdminRefreshToken(adminId: string, expiresIn: string): string {
    const full: AdminRefreshJwtPayload = {
      typ: ADMIN_REFRESH_JWT_TYP,
      adminId,
    };
    try {
      const options: SignOptions & { algorithm: "RS256" } = {
        algorithm: "RS256",
        expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
      };
      return jwt.sign(full, this.privateKey, options);
    } catch (error) {
      console.error("JWT Admin refresh sign error:", error);
      throw new UnauthorizedError("Failed to sign admin refresh token");
    }
  }

  verifyAdminAccessToken(token: string): DecodedAdminAccessToken {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ["RS256"],
      }) as DecodedAdminAccessToken;
      if (decoded.typ !== ADMIN_JWT_TYP) {
        throw new UnauthorizedError("Invalid token");
      }
      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError("Invalid token");
      }
      throw new UnauthorizedError("Failed to verify token");
    }
  }

  verifyAdminRefreshToken(token: string): DecodedAdminRefreshToken {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ["RS256"],
      }) as DecodedAdminRefreshToken;
      if (decoded.typ !== ADMIN_REFRESH_JWT_TYP) {
        throw new UnauthorizedError("Invalid token");
      }
      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError("Invalid token");
      }
      throw new UnauthorizedError("Failed to verify token");
    }
  }
}
