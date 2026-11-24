import { Link } from 'react-router-dom'
import { formatGuamDateTime } from '../lib/datetime'
import { formatTournamentWindow } from '../lib/games'
import type { SiteLink, SiteMode } from '../lib/siteMode'
import type { Tournament } from '../lib/types'

export function SeasonHero({ siteMode, tournament = siteMode.tournament }: {
  siteMode: SiteMode
  tournament?: Tournament | null
}) {
  const { mode, hostCampaign, recap, sections } = siteMode
  const history = { label: 'Explore History', to: '/history' }
  const visibleCampaign = sections.fundraisers ? hostCampaign : null
  const hostClass = visibleCampaign?.hostClass?.displayName || visibleCampaign?.title
  const nextEvent = visibleCampaign?.nextEvent
  let headline = hostClass ? `Support the ${hostClass}` : 'FD Alumni Basketball'
  let description = nextEvent
    ? [nextEvent.title, nextEvent.startsAt ? formatGuamDateTime(nextEvent.startsAt) : nextEvent.dateLabel].filter(Boolean).join(' · ')
    : visibleCampaign?.tagline
  let actions: SiteLink[] = [{ label: 'Support the host class', to: '/host-year' }, history]

  if (mode === 'schedule_ready') {
    headline = tournament ? `${tournament.year} Tournament Schedule` : 'Tournament Schedule'
    description = tournament ? formatTournamentWindow(tournament) : 'Season dates will be posted here.'
    actions = [
      ...(sections.schedule ? [{ label: 'See the schedule', to: '/schedule' }] : []),
      ...(sections.teams ? [{ label: 'Teams & Rosters', to: '/teams' }] : []),
      ...(sections.tickets ? [{ label: 'Tickets', to: '/tickets' }] : []),
    ]
  } else if (mode === 'tournament_recap') {
    headline = (sections.recap && recap.headline) || (tournament ? `${tournament.year} Tournament Recap` : 'Tournament Recap')
    description = sections.recap ? recap.summary : null
    actions = tournament ? [{ label: `View ${tournament.year} recap`, to: `/history/${tournament.year}` }, history] : [history]
  }

  const countdownDays = tournament && Math.ceil((Date.parse(`${tournament.startDate}T00:00:00+10:00`) - Date.now()) / 86_400_000)
  const showCountdown = (mode === 'fundraising' || mode === 'schedule_ready') && countdownDays !== null && countdownDays > 0

  return (
    <section className="hero-card public-hero-card" aria-label="Season overview">
      <div className="hero-text">
        <p className="eyebrow">FD Alumni Basketball</p>
        <h1>{headline}</h1>
        {description && <p>{description}</p>}
        {showCountdown && <p>{countdownDays} {countdownDays === 1 ? 'day' : 'days'} until tip-off</p>}
        <div className="hero-actions">
          {actions.map(({ to, label }, index) => <Link key={to} className={`btn ${index === 0 ? 'primary' : 'secondary'}`} to={to}>{label}</Link>)}
        </div>
      </div>
    </section>
  )
}
