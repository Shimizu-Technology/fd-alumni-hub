import { NextResponse } from 'next/server'
import { getStandings } from '@/lib/services/public-feed'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId') || undefined
  const data = await getStandings(tournamentId)
  return NextResponse.json(data)
}
