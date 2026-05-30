import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Graceful shutdown helper
export async function disconnectDb() {
  await prisma.$disconnect();
}
