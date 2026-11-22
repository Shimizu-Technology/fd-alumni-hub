import { STATIC_CHAMPIONS } from '../../lib/staticChampions'

const archiveStartYear = Math.min(...STATIC_CHAMPIONS.map(({ year }) => year))
const archiveEndYear = Math.max(...STATIC_CHAMPIONS.map(({ year }) => year))

export function StaticArchivePage({ onRetry }: { onRetry?: () => void }) {
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
            <div><strong>{STATIC_CHAMPIONS.length}</strong><span>tracked editions</span></div>
            <div><strong>{archiveStartYear}–{archiveEndYear}</strong><span>archive coverage</span></div>
            <div><strong>1</strong><span>brotherhood</span></div>
          </div>
        </section>

        <section className="archive-content" aria-labelledby="champions-heading">
          <div className="archive-section-heading">
            <div><p className="archive-eyebrow">Permanent public record</p><h2 id="champions-heading">Tournament champions</h2></div>
            <p>Compiled from alumni records, GSPN coverage, GuamPDN coverage, and tournament confirmations.</p>
          </div>
          <div className="archive-grid">
            {STATIC_CHAMPIONS.slice().reverse().map((record) => (
              <article key={`${record.year}-${record.editionLabel || record.bracket || 'annual'}`} className={record.status === 'cancelled' ? 'archive-record cancelled' : 'archive-record'}>
                <div className="archive-record-year">{record.year}{record.editionLabel ? <small>{record.editionLabel}</small> : record.bracket && record.bracket !== 'overall' ? <small>{record.bracket}</small> : null}</div>
                <div>
                  <strong>{record.status === 'cancelled' ? '—' : record.champion}</strong>
                  {record.runnerUp ? <p>Runner-up: {record.runnerUp}</p> : null}
                  {record.score ? <span>{record.score}</span> : null}
                  {record.status === 'cancelled' ? <p>{record.notes || 'Cancelled'}</p> : record.notes ? <p>{record.notes}</p> : null}
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
            {onRetry ? <button type="button" className="btn secondary" onClick={onRetry}>Check services again</button> : null}
          </div>
        </section>
      </main>

      <footer className="archive-footer">Built by <a href="https://shimizu-technology.com">Shimizu Technology</a>.</footer>
    </div>
  )
}
