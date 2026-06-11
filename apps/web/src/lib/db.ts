import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export function isMissingDatabaseUrlError(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.message.includes('Environment variable not found: DATABASE_URL')
}

export async function withDatabaseFallback<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDatabaseConfigured) return fallback

  try {
    return await operation()
  } catch (error) {
    if (isMissingDatabaseUrlError(error)) return fallback
    throw error
  }
}
