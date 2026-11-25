import { Link, useSearchParams } from 'react-router-dom'
import { safeHttpsHref } from '../../lib/urls'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { PageHeader, Panel } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'
import type { InfoGuide } from '../../lib/types'

const fallback: InfoGuide = {
  venueName: 'The Jungle (FD Gym)',
  venueAddress: '',
  ticketSourceName: 'HåfaPass',
  ticketSourceUrl: '/tickets',
  ticketSummary: 'Visit tournament tickets for current HåfaPass listings and session pricing.',
  doorInfo: 'Check the ticket listing for entry details for your session.',
  eligibilityHighlights: ['Confirm player eligibility and waiver requirements with tournament staff.'],
  gameRuleHighlights: ['Check the current tournament bylaws for game format and tie-break rules.'],
  conductHighlights: ['Treat officials, staff, alumni, families, and fans with respect.'],
  bylawDisclaimer: 'Follow the full tournament bylaws and current instructions from tournament staff.',
}

export function InfoPage() {
  const { siteMode } = useSiteMode()
  const [search] = useSearchParams()
  const year = search.get('year') || undefined
  const tournamentId = search.get('tournamentId') || undefined
  const { data, error, reload } = useAsync(async () => ({
    key: JSON.stringify([year, tournamentId]),
    payload: await api.publicInfo({ year, tournamentId }),
  }), [year, tournamentId])
  const season = data?.key === JSON.stringify([year, tournamentId]) ? data.payload : null
  const guide = season?.infoGuide || fallback
  const ticketPath = /^\/(?!\/)[^\\\s]*$/.test(guide.ticketSourceUrl) ? guide.ticketSourceUrl : null
  const externalTicket = safeHttpsHref(guide.ticketSourceUrl)

  return (
    <div className="page-stack info-page">
      <PageHeader
        title="Venue & Rules"
        description={season ? `${season.tournament.year} · ${season.tournament.name}` : 'FD Alumni Basketball Tournament'}
        actions={siteMode.sections.schedule
          ? <Link className="btn secondary" to="/schedule">Open schedule <IconArrowRight /></Link>
          : <Link className="btn secondary" to="/">Host Year Hub <IconArrowRight /></Link>}
      />
      {error && <p role="status">Season details are unavailable. Showing general tournament guidance. <button className="btn secondary small" onClick={reload}>Retry</button></p>}
      <section className="info-hero-grid">
        <Panel className="info-feature-card">
          <h2>{guide.venueName}</h2>
          {guide.venueAddress && <p>{guide.venueAddress}</p>}
          <h3>At the door</h3>
          <p>{guide.doorInfo}</p>
        </Panel>
        <Panel className="info-feature-card ticket-info-card">
          <h2>Tickets</h2>
          <p>{guide.ticketSummary}</p>
          {!ticketPath && externalTicket
            ? <a className="btn primary" href={externalTicket} target="_blank" rel="noreferrer">{guide.ticketSourceName} <IconExternal /></a>
            : <Link className="btn primary" to={ticketPath || '/tickets'}>Tournament tickets <IconArrowRight /></Link>}
        </Panel>
      </section>
      <section className="info-section-grid">
        <InfoListCard title="Roster and eligibility" items={guide.eligibilityHighlights} />
        <InfoListCard title="Game format" items={guide.gameRuleHighlights} />
        <InfoListCard title="Conduct and operations" items={guide.conductHighlights} />
      </section>
      <Panel className="notice-panel rules-note-panel">{guide.bylawDisclaimer}</Panel>
    </div>
  )
}

function InfoListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel className="info-list-card">
      <h2>{title}</h2>
      <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </Panel>
  )
}
