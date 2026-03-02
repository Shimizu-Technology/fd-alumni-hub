import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function ensureAppUser() {
  const { userId } = await auth()
  if (!userId) return null

  const clerkUser = await currentUser()
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase()
  if (!email) return null

  let appUser = await db.appUser.findUnique({ where: { clerkId: userId } })
  if (appUser) return appUser

  const allowed = await db.adminWhitelist.findUnique({ where: { email } })
  if (!allowed || !allowed.isActive) return null

  appUser = await db.appUser.create({
    data: {
      clerkId: userId,
      email,
      role: allowed.role,
      isActive: true,
    },
  })
  return appUser
}

export async function requireAdmin() {
  const appUser = await ensureAppUser()
  return appUser && appUser.isActive && appUser.role === 'admin' ? appUser : null
}

export async function requireStaff() {
  const appUser = await ensureAppUser()
  return appUser && appUser.isActive ? appUser : null
}
