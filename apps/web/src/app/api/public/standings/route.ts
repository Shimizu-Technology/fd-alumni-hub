import { NextResponse } from 'next/server'
import { getStandings } from '@/lib/services/public-feed'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId') || undefined
  const division = searchParams.get('division') || undefined
  const data = await getStandings(tournamentId, division)
  return NextResponse.json(data)
}
