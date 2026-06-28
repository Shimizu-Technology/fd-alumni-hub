import { NextResponse } from 'next/server'
import { getSchedule } from '@/lib/services/public-feed'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId') || undefined
  const division = searchParams.get('division') || undefined
  const phase = searchParams.get('phase') as 'pool' | 'playoff' | 'fatherson' | null
  const data = await getSchedule(tournamentId, division, phase)
  return NextResponse.json(data)
}
