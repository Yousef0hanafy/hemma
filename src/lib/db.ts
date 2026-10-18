import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// One client per process. Cached on globalThis in every environment so dev
// hot-reloads and warm serverless invocations reuse the same connection pool.
// (No custom SIGTERM handlers: Prisma disconnects on exit by itself, and
// calling process.exit() there cut off in-flight requests.)
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['error', 'warn'] })

globalForPrisma.prisma = db
