import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
    };
    session?: {
      id: string;
      token: string;
      expiresAt: Date;
    };
  }
}
