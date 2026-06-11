export type DivisionConfig = {
  id: string
  label: string
  description: string
  color: string
  colorMuted: string
  sortOrder: number
}

export const DIVISIONS: DivisionConfig[] = [
  { id: 'Maroon', label: 'Maroon', description: 'Primary alumni division', color: '#6f1d35', colorMuted: '#f7e8ee', sortOrder: 10 },
  { id: 'Gold', label: 'Gold', description: 'Second alumni division', color: '#b8872d', colorMuted: '#fff3d8', sortOrder: 20 },
  { id: 'Platinum', label: 'Platinum', description: 'Veteran alumni division', color: '#5f6b7a', colorMuted: '#eef2f7', sortOrder: 30 },
  { id: 'Special', label: 'Special', description: 'Father-Son and special events', color: '#1d4ed8', colorMuted: '#e6efff', sortOrder: 40 },
]

export function getDivision(id?: string | null) {
  if (!id) return undefined
  return DIVISIONS.find((division) => division.id.toLowerCase() === id.toLowerCase())
}

export function orderedDivisions(activeDivisions: string[]) {
  return DIVISIONS
    .filter((division) => activeDivisions.includes(division.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function resolveGameDivision(gameDivision?: string | null, teamDivision?: string | null) {
  return gameDivision || teamDivision || null
}

export const BRACKET_CODES: Record<string, string> = {
  MP: 'Maroon playoff',
  WMP: 'Winner Maroon playoff',
  GP: 'Gold playoff',
  WGP: 'Winner Gold playoff',
  PP: 'Platinum playoff',
  WPP: 'Winner Platinum playoff',
  FS: 'Father-Son',
  QF: 'Quarterfinal',
  SF: 'Semifinal',
  F: 'Final',
}
