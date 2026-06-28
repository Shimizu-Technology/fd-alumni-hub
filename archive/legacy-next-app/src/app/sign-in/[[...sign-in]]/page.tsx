import { SignIn } from '@clerk/nextjs'

export default function Page() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
        <div className="rounded-xl border bg-white p-6 text-center" style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin sign-in unavailable</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--neutral-500)' }}>
            Clerk is not configured in this environment. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable admin access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
      <SignIn />
    </div>
  )
}
