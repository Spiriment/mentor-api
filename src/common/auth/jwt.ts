import jwt, { SignOptions } from "jsonwebtoken";
import { UserPayload, DecodedToken } from "../types";
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
}
