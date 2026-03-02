import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
      <SignIn />
    </div>
  )
}
