type ChampionRecord = {
  year: number
  edition?: string
  champion: string
  runnerUp?: string
  score?: string
  cancelled?: boolean
}

const champions: ChampionRecord[] = [
  { year: 1985, champion: 'Class of 1974' }, { year: 1986, champion: 'Class of 1974' },
  { year: 1987, edition: 'Spring', champion: 'Class of 1980' }, { year: 1987, edition: 'Summer', champion: 'Class of 1982' }, { year: 1987, edition: 'Fall', champion: 'Class of 1979' },
  { year: 1988, champion: 'Class of 1982' }, { year: 1989, champion: 'Class of 1980' }, { year: 1991, champion: 'Class of 1991' },
  { year: 1992, champion: 'Class of 1982' }, { year: 1993, champion: 'Class of 1991' }, { year: 1994, champion: 'Class of 1982' },
  { year: 1995, champion: 'Class of 1982' }, { year: 1996, champion: 'Class of 1982' }, { year: 1997, champion: 'Class of 1991' },
  { year: 1998, champion: 'Class of 1982' }, { year: 1999, champion: 'Class of 1995/96' }, { year: 2000, champion: 'Class of 1996' },
  { year: 2001, champion: 'Class of 1991' }, { year: 2002, champion: 'Class of 1996' }, { year: 2003, champion: 'Class of 1996' },
  { year: 2004, champion: 'Class of 1995' }, { year: 2005, champion: 'Class of 1991' }, { year: 2006, champion: 'Class of 2002/03' },
  { year: 2007, champion: 'Class of 2006' }, { year: 2008, champion: 'Class of 1995' }, { year: 2009, champion: 'Class of 2002' },
  { year: 2010, champion: 'Class of 2006' }, { year: 2011, champion: 'Class of 2006' }, { year: 2012, champion: 'Class of 2006' },
  { year: 2013, champion: 'Class of 2006' }, { year: 2014, champion: 'Class of 2004' }, { year: 2015, champion: 'Class of 2013', score: '60–48' },
  { year: 2016, champion: 'Class of 2006' }, { year: 2017, champion: 'Class of 2002/04' }, { year: 2018, champion: 'Class of 2002/04' },
  { year: 2019, champion: 'Class of 2006' }, { year: 2020, champion: '—', cancelled: true },
  { year: 2021, champion: 'Class of 2006', runnerUp: 'Class of 2011', score: '58–38' },
  { year: 2022, champion: 'Class of 2002/04', runnerUp: 'Class of 2006', score: '62–52' },
  { year: 2023, champion: 'Class of 2013' },
  { year: 2024, champion: 'Class of 2016/17', runnerUp: 'Class of 2002/04', score: '58–56' },
  { year: 2025, champion: 'Class of 2002/04', runnerUp: 'Class of 2013', score: '50–44' },
]

export function StaticArchivePage() {
  return (
    <div className="archive-shell">
      <header className="archive-header">
        <div className="archive-brand">
          <img src="/brand/fd-crest.png" alt="Father Dueñas Memorial School crest" />
          <div><strong>FD Alumni Basketball Hub</strong><span>Historical tournament archive</span></div>
        </div>
        <span className="archive-status">Off-season archive</span>
      </header>

      <main>
        <section className="archive-hero">
          <p className="archive-eyebrow">Brotherhood. Competition. History.</p>
          <h1>Decades of FD Alumni champions, preserved.</h1>
          <p>The live tournament hub is resting between events, but its core championship record remains available. Full schedules, live scores, admin tools, and media will return when the next tournament is activated.</p>
          <div className="archive-stats">
            <div><strong>{champions.length}</strong><span>tracked editions</span></div>
            <div><strong>1985–2025</strong><span>archive coverage</span></div>
            <div><strong>1</strong><span>brotherhood</span></div>
          </div>
        </section>

        <section className="archive-content" aria-labelledby="champions-heading">
          <div className="archive-section-heading">
            <div><p className="archive-eyebrow">Permanent public record</p><h2 id="champions-heading">Tournament champions</h2></div>
            <p>Compiled from alumni records, GSPN coverage, GuamPDN coverage, and tournament confirmations.</p>
          </div>
          <div className="archive-grid">
            {champions.slice().reverse().map((record) => (
              <article key={`${record.year}-${record.edition || 'annual'}`} className={record.cancelled ? 'archive-record cancelled' : 'archive-record'}>
                <div className="archive-record-year">{record.year}{record.edition ? <small>{record.edition}</small> : null}</div>
                <div>
                  <strong>{record.champion}</strong>
                  {record.runnerUp ? <p>Runner-up: {record.runnerUp}</p> : null}
                  {record.score ? <span>{record.score}</span> : null}
                  {record.cancelled ? <p>Cancelled because of COVID-19</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="archive-return">
          <p className="archive-eyebrow">The hub will return</p>
          <h2>Live tournament coverage is paused—not gone.</h2>
          <p>When the next event is confirmed, schedules, standings, streams, stories, gallery coverage, and team tools can be restored by reactivating the service.</p>
          <div className="archive-links">
            <a href="https://fatherduenas.com/" target="_blank" rel="noreferrer">Visit Father Dueñas</a>
            <a href="https://guamsportsnetwork.com/" target="_blank" rel="noreferrer">Visit GSPN</a>
          </div>
        </section>
      </main>

      <footer className="archive-footer">Built by <a href="https://shimizu-technology.com">Shimizu Technology</a>.</footer>
    </div>
  )
}
