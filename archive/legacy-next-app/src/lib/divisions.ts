/**
 * Division configuration for FD Alumni Basketball Tournament.
 *
 * This is the single source of truth for all division metadata.
 * To add a new division (e.g. Platinum), add an entry to DIVISIONS.
 * Class year ranges are informational defaults — actual assignment is
 * stored explicitly on the Team record in the database.
 *
 * Bracket code prefixes follow the playoff notation from tournament PDFs:
 *   M = Maroon, G = Gold, P = Platinum
 *   MP = Maroon Playoff, WMP = Winner Maroon Playoff, etc.
 */

export type DivisionId = string // open-ended string so adding new divisions never requires a type change

export type Division = {
  id: DivisionId
  label: string
  shortCode: string   // single letter prefix used in bracket codes (M, G, P)
  color: string       // primary hex color for UI
  colorMuted: string  // muted/background variant
  /** Approximate newer class year cutoff (inclusive lower bound). Null = no lower bound */
  classYearMin: number | null
  /** Approximate older class year cutoff (inclusive upper bound). Null = no upper bound */
  classYearMax: number | null
  description: string
  sortOrder: number
}

export type BracketCode = {
  code: string
  label: string
  divisionId: DivisionId
  isWinnerSlot?: boolean // true for WMP/WGP/WPP etc (winner-of-playoff placeholders)
}

// ── Division definitions ─────────────────────────────────────────────────────
// Add new divisions here. sortOrder determines display order.
export const DIVISIONS: Division[] = [
  {
    id: 'Maroon',
    label: 'Maroon Division',
    shortCode: 'M',
    color: '#7b1632',
    colorMuted: 'rgba(123,22,50,0.08)',
    classYearMin: 2002,
    classYearMax: null, // through current + upcoming years
    description: 'Younger classes (approx. 2002 and newer)',
    sortOrder: 0,
  },
  {
    id: 'Gold',
    label: 'Gold Division',
    shortCode: 'G',
    color: '#b8900a',
    colorMuted: 'rgba(184,144,10,0.08)',
    classYearMin: null,
    classYearMax: 2001,
    description: 'Older classes (approx. 2001 and older)',
    sortOrder: 1,
  },
  {
    id: 'Platinum',
    label: 'Platinum Division',
    shortCode: 'P',
    color: '#6b7a8d',
    colorMuted: 'rgba(107,122,141,0.08)',
    classYearMin: null,
    classYearMax: null,
    description: 'Oldest classes / special bracket',
    sortOrder: 2,
  },
]

// ── Bracket codes ─────────────────────────────────────────────────────────────
// Standard codes from tournament playoff sheets.
// Extend by adding entries — the UI reads this table.
export const BRACKET_CODES: BracketCode[] = [
  // Maroon
  { code: 'MP',  label: 'Maroon Playoff',         divisionId: 'Maroon' },
  { code: 'WMP', label: 'Winner Maroon Playoff',  divisionId: 'Maroon', isWinnerSlot: true },
  // Gold
  { code: 'GP',  label: 'Gold Playoff',           divisionId: 'Gold' },
  { code: 'WGP', label: 'Winner Gold Playoff',    divisionId: 'Gold', isWinnerSlot: true },
  // Platinum
  { code: 'PP',  label: 'Platinum Playoff',       divisionId: 'Platinum' },
  { code: 'WPP', label: 'Winner Platinum Playoff',divisionId: 'Platinum', isWinnerSlot: true },
  // Generic round labels (division-agnostic)
  { code: 'QF',  label: 'Quarterfinal',           divisionId: '' },
  { code: 'SF',  label: 'Semifinal',              divisionId: '' },
  { code: 'F',   label: 'Final',                  divisionId: '' },
  { code: 'R1',  label: 'Round 1',               divisionId: '' },
  { code: 'R2',  label: 'Round 2',               divisionId: '' },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getDivision(id: DivisionId | null | undefined): Division | undefined {
  if (!id) return undefined
  return DIVISIONS.find(d => d.id === id)
}

export function getBracketCode(code: string | null | undefined): BracketCode | undefined {
  if (!code) return undefined
  return BRACKET_CODES.find(b => b.code === code)
}

/**
 * Infer division from a class year label (e.g. "02", "2002", "25", "2025").
 * Returns the first matching division or undefined if no match.
 * This is a default suggestion only — explicit DB assignment overrides this.
 */
export function inferDivisionFromClassYear(classYearLabel: string): Division | undefined {
  const raw = classYearLabel.trim().replace(/^Class\s*/i, '')
  let year = parseInt(raw, 10)
  if (isNaN(year)) return undefined
  // Normalize 2-digit years: 00-30 → 2000-2030, 31-99 → 1931-1999
  if (year < 100) year = year <= 30 ? 2000 + year : 1900 + year

  // Walk divisions in sortOrder; first match wins
  const sorted = [...DIVISIONS].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const div of sorted) {
    const aboveMin = div.classYearMin === null || year >= div.classYearMin
    const belowMax = div.classYearMax === null || year <= div.classYearMax
    if (aboveMin && belowMax) return div
  }
  return undefined
}

/** All bracket codes for a given division (including generic ones) */
export function getBracketCodesForDivision(divisionId: DivisionId): BracketCode[] {
  return BRACKET_CODES.filter(b => b.divisionId === divisionId || b.divisionId === '')
}

/** Resolve effective division: game.division → homeTeam.division → null */
export function resolveGameDivision(
  gameDivision: string | null | undefined,
  homeTeamDivision: string | null | undefined,
): DivisionId | null {
  return gameDivision ?? homeTeamDivision ?? null
}
