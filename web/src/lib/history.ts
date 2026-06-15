export type ChampionRecord = {
  year: number
  champion?: string
  runnerUp?: string
  score?: string
  source: string
  status?: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'unknown'
  note?: string
}

export const CHAMPIONS: ChampionRecord[] = [
  { year: 2025, champion: 'Class of 2002/04', runnerUp: 'Class of 2013', score: '50-44', source: 'GuamPDN', status: 'completed' },
  { year: 2024, champion: 'Class of 2016/17', runnerUp: 'Class of 2002/04', score: '58-56', source: 'GSPN', status: 'completed' },
  { year: 2023, champion: 'Class of 2013', source: 'GSPN', status: 'completed' },
  { year: 2022, champion: 'Class of 2002/04', runnerUp: 'Class of 2006', score: '62-52', source: 'GSPN', status: 'completed' },
  { year: 2021, champion: 'Class of 2006', runnerUp: 'Class of 2011', score: '58-38', source: 'GSPN', status: 'completed' },
  { year: 2020, source: 'COVID-19', status: 'cancelled', note: 'Tournament cancelled' },
  { year: 2019, champion: 'Class of 2006', source: 'GSPN', status: 'completed' },
  { year: 2018, champion: 'Class of 2002/04', source: 'GSPN', status: 'completed' },
  { year: 2017, champion: 'Class of 2002/04', source: 'GSPN', status: 'completed' },
  { year: 2016, source: 'Research pending', status: 'unknown', note: 'Champion data still unverified' },
  { year: 2015, champion: 'Class of 2013', score: '60-48', source: 'GSPN', status: 'completed' },
  { year: 2014, champion: 'Class of 2004', source: 'GSPN', status: 'completed' },
]
