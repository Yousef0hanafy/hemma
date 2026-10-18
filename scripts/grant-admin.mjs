#!/usr/bin/env node
// Promote an existing user to admin (or another studio role).
//
// Usage:
//   DATABASE_URL=... pnpm admin:grant <email> [role]
//
// role defaults to "admin"; valid roles: student | reviewer | editor | admin.
// The user must have signed in at least once so their row exists.

import { PrismaClient } from "@prisma/client";

const VALID_ROLES = ["student", "reviewer", "editor", "admin"];
const [email, role = "admin"] = process.argv.slice(2);

if (!email || !VALID_ROLES.includes(role)) {
  console.error("Usage: pnpm admin:grant <email> [student|reviewer|editor|admin]");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error(`No user with email ${email}. Sign in once first, then re-run.`);
    process.exitCode = 1;
  } else {
    await db.user.update({ where: { id: user.id }, data: { role } });
    console.log(`${user.email}: ${user.role} -> ${role}`);
  }
} finally {
  await db.$disconnect();
}
