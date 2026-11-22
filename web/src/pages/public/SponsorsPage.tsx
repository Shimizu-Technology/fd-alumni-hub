import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { groupSponsorsByTier } from '../../lib/sponsors'
import { safeHttpsHref } from '../../lib/urls'
import { LoadingState, PageHeader, Panel, SectionUnavailable } from '../../components/ui'
import { IconExternal } from '../../components/Icons'

export function SponsorsPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicSponsors(), [])

  const groups = groupSponsorsByTier(data?.sponsors || [])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Partners and sponsors"
        title="Tournament support"
        description="A dedicated space for the businesses and community partners supporting the tournament."
      />

      {loading && !data ? (
        <LoadingState label="Loading sponsors" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Sponsor listings are temporarily unavailable"
          description="Could not load sponsor placements right now."
          onRetry={reload}
        />
      ) : groups.length === 0 ? (
        <Panel className="sponsor-placeholder">
          <h2>Sponsor announcements coming soon</h2>
          <p>Approved tournament partners will appear here with logos and links as sponsor packages are confirmed.</p>
        </Panel>
      ) : (
        groups.map((group) => (
          <section key={group.tier} className={`sponsor-tier sponsor-tier--${group.tier}`} aria-labelledby={`sponsor-tier-${group.tier}`}>
            <h2 id={`sponsor-tier-${group.tier}`}>{group.label}</h2>
            <div className={`sponsor-grid sponsor-grid--${group.tier}`}>
              {group.sponsors.map((sponsor) => {
                const targetHref = safeHttpsHref(sponsor.targetUrl)
                const logoHref = safeHttpsHref(sponsor.logoUrl)
                const content = (
                  <>
                    {logoHref ? (
                      <img src={logoHref} alt={`${sponsor.name} logo`} loading="lazy" />
                    ) : (
                      <span className="sponsor-initials" aria-hidden="true">{sponsor.name.slice(0, 2).toUpperCase()}</span>
                    )}
                    <strong>{sponsor.name}</strong>
                    {sponsor.description && <p className="sponsor-description">{sponsor.description}</p>}
                    {targetHref && <small>Visit partner <IconExternal /></small>}
                  </>
                )

                return targetHref ? (
                  <a
                    key={sponsor.id}
                    className={`sponsor-card sponsor-card--${group.tier}`}
                    href={targetHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {content}
                  </a>
                ) : (
                  <div key={sponsor.id} className={`sponsor-card sponsor-card--${group.tier}`}>
                    {content}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
