import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { HostYearShowcase } from '../../components/HostYearShowcase'
import { IconTrophy } from '../../components/Icons'
import { EmptyState, LoadingState, SectionUnavailable } from '../../components/ui'

export function HostYearPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const rawYear = searchParams.get('year')
  const yearParam = !slug && rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : undefined
  const queryKey = JSON.stringify({ slug: slug || '', year: yearParam ?? '' })

  const { data: rawData, loading, error, errorStatus, reload } = useAsync(
    async () => ({
      queryKey,
      payload: await api.publicHostYear({ slug: slug || undefined, year: yearParam }),
    }),
    [queryKey],
  )

  const data = rawData?.queryKey === queryKey ? rawData.payload : null
  if (loading && !data) {
    return <LoadingState label="Loading host year hub" />
  }

  if (error && !data) {
    if (errorStatus === 404) {
      return (
        <div className="page-stack host-year-page">
          <section className="hero-card public-hero-card">
            <div className="hero-text">
              <p className="eyebrow">Host Year · FD Alumni Brotherhood</p>
              <h1>Host-year fundraisers, updates, and tournament countdown.</h1>
              <p>Each year’s host class shares upcoming fundraisers, ticket links, golf registration, and class announcements here.</p>
            </div>
          </section>
          <EmptyState
            title="Host year page not published yet"
            description="No active host-year campaign is published for this link yet. Browse tournament history or game-day info in the meantime."
            action={<Link className="btn secondary" to="/history">Browse champion history</Link>}
          />
        </div>
      )
    }

    return (
      <div className="page-stack host-year-page">
        <section className="hero-card public-hero-card">
          <div className="hero-text">
            <p className="eyebrow">Host Year · FD Alumni Brotherhood</p>
            <h1>Fundraisers, tickets, and class updates in one place.</h1>
            <p>Each host class organizes its fundraisers, golf tournament, sponsor updates, and tournament countdown from this hub.</p>
            <div className="hero-actions">
              <Link className="btn primary" to="/history"><IconTrophy /> Champion history</Link>
              <Link className="btn secondary" to="/info">Tournament info</Link>
            </div>
          </div>
        </section>
        <SectionUnavailable
          title="Host year details are temporarily unavailable"
          description="Live campaign fundraisers, countdown, and class announcements require the hub API."
          onRetry={reload}
          action={<Link className="btn secondary" to="/history">Browse offline champions</Link>}
        />
      </div>
    )
  }

  return data ? <HostYearShowcase data={data} /> : null
}
