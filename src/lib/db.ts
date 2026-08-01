import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure connection pooling and timeouts for production
const prismaClientOptions = {
  log: ['error', 'warn'] as ('error' | 'warn')[],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Graceful shutdown handler
if (typeof window === 'undefined') {
  // Handle graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing database connections...`);
    try {
      await db.$disconnect();
      console.log('Database connections closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during database disconnection:', error);
      process.exit(1);
    }
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
}
