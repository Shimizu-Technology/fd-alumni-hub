import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '../../components/ui'
import { IconExternal } from '../../components/Icons'

export function SponsorsPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicSponsors(), [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const grouped = groupSponsors(data?.sponsors || [])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Partners and sponsors"
        title="Tournament support"
        description="A clean, partner-friendly sponsor page ready for 2026 placements once packages and approvals are finalized."
      />

      {Object.keys(grouped).length === 0 ? (
        <Panel className="sponsor-placeholder">
          <h2>2026 sponsor placements are available</h2>
          <p>Organizer-approved sponsors can be added from the admin console with logo, tier, position, and destination URL. Until then, this page stays intentionally reserved.</p>
        </Panel>
      ) : (
        Object.entries(grouped).map(([tier, sponsors]) => (
          <section key={tier} className="sponsor-tier">
            <h2>{tier}</h2>
            <div className="sponsor-grid">
              {sponsors.map((sponsor) => {
                const content = (
                  <>
                    {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt="" loading="lazy" /> : <span className="sponsor-initials">{sponsor.name.slice(0, 2).toUpperCase()}</span>}
                    <strong>{sponsor.name}</strong>
                    {sponsor.targetUrl && <small>Visit partner <IconExternal /></small>}
                  </>
                )

                return sponsor.targetUrl ? (
                  <a key={sponsor.id} className="sponsor-card" href={sponsor.targetUrl} target="_blank" rel="noreferrer">{content}</a>
                ) : (
                  <div key={sponsor.id} className="sponsor-card">{content}</div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function groupSponsors(sponsors: Awaited<ReturnType<typeof api.publicSponsors>>['sponsors']) {
  return sponsors.reduce<Record<string, typeof sponsors>>((acc, sponsor) => {
    const tier = sponsor.tier || 'Community Partners'
    acc[tier] ||= []
    acc[tier].push(sponsor)
    return acc
  }, {})
}
