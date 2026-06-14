import { formatGuamDate, formatGuamDateTime } from './datetime'
import type { Division, Game, RelatedGameSummary, Tournament, Team } from './types'

export const DEFAULT_GAME_VENUE = 'The Jungle'

export function formatTournamentWindow(tournament?: Pick<Tournament, 'startDate' | 'endDate'> | null) {
  if (!tournament?.startDate || !tournament?.endDate) return 'Dates pending'

  if (tournament.startDate === tournament.endDate) {
    return formatGuamDate(tournament.endDate, { year: 'numeric' })
  }

  const sameYear = tournament.startDate.slice(0, 4) === tournament.endDate.slice(0, 4)
  const start = formatGuamDate(tournament.startDate, { year: sameYear ? undefined : 'numeric' })
  const end = formatGuamDate(tournament.endDate, { year: 'numeric' })
  return `${start}–${end}`
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

export function divisionSelectOptions(divisions: Division[], currentName?: string | null) {
  const options = divisions.map((division) => ({ id: division.id, name: division.name }))
  if (currentName && !options.some((division) => division.name === currentName)) {
    options.push({ id: '', name: currentName })
  }
  return options
}

export function divisionNameById(divisionId: string | null | undefined, divisions: Division[]) {
  return divisions.find((division) => division.id === divisionId)?.name || ''
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
