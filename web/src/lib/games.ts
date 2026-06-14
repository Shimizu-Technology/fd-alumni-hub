import { formatGuamDate, formatGuamDateTime } from './datetime'
import type { Game, RelatedGameSummary, Tournament, Team } from './types'

export const DEFAULT_GAME_VENUE = 'The Jungle'
export const DEFAULT_DIVISIONS = ['Maroon', 'Gold', 'Platinum', 'Diamond']

export function formatTournamentWindow(tournament?: Pick<Tournament, 'startDate' | 'endDate'> | null) {
  if (!tournament?.startDate || !tournament?.endDate) return 'Dates pending'

  const start = formatGuamDate(tournament.startDate, { year: undefined })
  const end = formatGuamDate(tournament.endDate, { year: 'numeric' })
  return start === end ? end : `${start}–${end}`
}

export function gameMatchupLabel(game?: Pick<Game, 'homeTeam' | 'awayTeam'> | Pick<RelatedGameSummary, 'homeTeam' | 'awayTeam'> | null) {
  if (!game) return 'No game selected'

  const away = game.awayTeam?.displayName || 'Away team'
  const home = game.homeTeam?.displayName || 'Home team'
  return `${away} at ${home}`
}

export function gameOptionLabel(game: Game | RelatedGameSummary) {
  return `${formatGuamDateTime(game.startTime)} · ${gameMatchupLabel(game)}`
}

export function divisionOptions(teams: Team[] = [], games: Array<Pick<Game, 'division'>> = []) {
  return Array.from(new Set([
    ...teams.map((team) => team.division).filter(Boolean),
    ...games.map((game) => game.division).filter(Boolean),
    ...DEFAULT_DIVISIONS,
  ] as string[]))
}

export function teamDivision(teamId: string, teams: Team[]) {
  return teams.find((team) => team.id === teamId)?.division || ''
}

export function gameResultLabel(game?: Pick<Game, 'homeScore' | 'awayScore' | 'homeTeam' | 'awayTeam'> | Pick<RelatedGameSummary, 'homeScore' | 'awayScore' | 'homeTeam' | 'awayTeam'> | null) {
  if (!game || game.homeScore === null || game.awayScore === null) return null

  if (game.homeScore === game.awayScore) return 'Tie score'

  const winner = game.homeScore > game.awayScore ? game.homeTeam?.displayName : game.awayTeam?.displayName
  return winner ? `Winner: ${winner}` : 'Winner recorded'
}
