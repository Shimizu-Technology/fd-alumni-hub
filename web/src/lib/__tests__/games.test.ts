import { describe, expect, it } from 'vitest'
import { gameMatchupLabel, gameResultLabel } from '../games'

describe('games helpers', () => {
  it('formats matchup and result labels cleanly', () => {
    const game = {
      homeTeam: { id: '1', displayName: 'Class of 2017', classYearLabel: '2017', classCohorts: [], divisionId: null, division: 'Maroon' },
      awayTeam: { id: '2', displayName: 'Class of 2016', classYearLabel: '2016', classCohorts: [], divisionId: null, division: 'Maroon' },
      homeScore: 61,
      awayScore: 49,
    }
    expect(gameMatchupLabel(game)).toBe('Class of 2016 at Class of 2017')
    expect(gameResultLabel(game)).toBe('Winner: Class of 2017')
    expect(gameResultLabel({ ...game, homeScore: 50, awayScore: 50 })).toBe('Tie score')
    expect(gameResultLabel({ ...game, homeScore: null, awayScore: null })).toBeNull()
  })
})
