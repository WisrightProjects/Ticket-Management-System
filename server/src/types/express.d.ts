import type { UserRole } from "@tms/core";

// Express 5's Request<...> extends global Express.Request, so augmenting
// the global namespace is the correct extension point for custom properties.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        isActive: boolean;
      };
      session?: {
        id: string;
        token: string;
        expiresAt: Date;
      };
    }
  }
}

export {};
