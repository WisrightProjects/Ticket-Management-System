import { hashPassword } from "better-auth/crypto";
import prisma from "../src/lib/prisma.js";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();

  await prisma.user.create({
    data: {
      id: userId,
      name: "Admin",
      email,
      role: "ADMIN",
      emailVerified: true,
      isActive: true,
    },
  });

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  console.log("Admin user created (role: ADMIN)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
