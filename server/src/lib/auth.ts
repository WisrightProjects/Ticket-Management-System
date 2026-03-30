import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:5173"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "AGENT",
        input: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
});
