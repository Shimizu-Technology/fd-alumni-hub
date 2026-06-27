import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { externalHref } from '../../lib/urls'
import { PageHeader, Panel } from '../../components/ui'
import { IconArrowRight, IconCalendar, IconExternal, IconShield, IconTrophy } from '../../components/Icons'

const eligibilityHighlights = [
  'Players must meet FD alumni or honorary alumni eligibility requirements verified by FD administration.',
  'Players must be 18 or have a parental release on file.',
  'Liability and waiver forms are required before a player can play.',
  'Use full names in the scorebook so local coverage can identify players accurately.',
]

const gameRuleHighlights = [
  'Games use two 20-minute halves with a five-minute halftime.',
  'The first 37 minutes run continuously; the final three minutes of the second half use stop clock rules.',
  'Teams need five eligible players to start. Grace-period and forfeit rules apply.',
  'Pool-play ties use a three-point shootout. Playoff ties use a three-minute overtime period.',
  'The white three-point line is used, and the pool-play 4-point area is in effect for 2026.',
]

const conductHighlights = [
  'Complete uniforms are required. Incomplete uniforms may result in a team fee.',
  'No jewelry is allowed during games.',
  'Teams are responsible for cleaning their bench area and helping keep the court dry and safe.',
  'Sportsmanship toward officials, staff, alumni, families, and fans is expected throughout the tournament.',
]

export function InfoPage() {
  return (
    <div className="page-stack info-page">
      <PageHeader
        eyebrow="Tournament info"
        title="Tickets, rules, and game-day basics"
        description="A fan-friendly summary of the 2026 FD Alumni Basketball Tournament information. GuamTime remains the source of truth for ticket purchase details and current pricing."
        actions={<Link className="btn secondary" to="/schedule">Open schedule <IconArrowRight /></Link>}
      />

      <section className="info-hero-grid">
        <Panel className="info-feature-card ticket-info-card">
          <span className="info-card-icon"><IconExternal /></span>
          <h2>Tickets</h2>
          <p>Most games are expected to use the same GuamTime event link, with championship sessions handled separately if organizers post a different listing.</p>
          <p>Prices may vary by session or event. Always confirm the active price on GuamTime before purchasing.</p>
          <a className="btn primary" href={externalHref(import.meta.env.VITE_GUAMTIME_URL || 'https://guamtime.net') || undefined} target="_blank" rel="noreferrer">Open GuamTime <IconExternal /></a>
        </Panel>

        <Panel className="info-feature-card">
          <span className="info-card-icon"><IconCalendar /></span>
          <h2>Schedule</h2>
          <p>Pool play is loaded from the organizer schedule. Playoff and championship details should be added as matchups are confirmed.</p>
          <Link className="btn secondary" to="/schedule">View schedule <IconArrowRight /></Link>
        </Panel>
      </section>

      <section className="info-section-grid">
        <InfoListCard icon={<IconShield />} title="Roster and eligibility" items={eligibilityHighlights} />
        <InfoListCard icon={<IconTrophy />} title="Game format" items={gameRuleHighlights} />
        <InfoListCard icon={<IconShield />} title="Conduct and operations" items={conductHighlights} />
      </section>

      <Panel className="notice-panel rules-note-panel">
        This page is a summarized guide, not the full tournament by-laws. If anything differs from organizer instructions, FDMSAA and tournament staff guidance controls.
      </Panel>
    </div>
  )
}

function InfoListCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <Panel className="info-list-card">
      <span className="info-card-icon">{icon}</span>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </Panel>
  )
}
