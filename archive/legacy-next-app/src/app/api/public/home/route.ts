import { NextResponse } from 'next/server'
import { getHomeFeed } from '@/lib/services/public-feed'

export async function GET() {
  const data = await getHomeFeed()
  return NextResponse.json(data)
}
