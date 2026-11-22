import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from '../../components/ui'
import { api } from '../../lib/api'
import { auditFieldDiff, auditFieldLabel } from '../../lib/audit'
import { formatGuamDate, formatGuamTime } from '../../lib/datetime'
import type { AdminAuditFilters, AdminAuditResponse, AuditEvent } from '../../lib/types'

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(displayValue).join(', ') || '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function AuditHistoryEntry({ event, showOperation }: { event: AuditEvent; showOperation: (id: string) => void }) {
  const fields = auditFieldDiff(event)
  const actor = event.actorName || event.actorEmail || auditFieldLabel(event.actorType)
  const headingId = `audit-event-${event.id}`

  return (
    <li className="audit-entry">
      <div className="audit-entry-meta">
        <span className="audit-area">{auditFieldLabel(event.area)}</span>
        {event.legacySource === 'finance_audit_events' && <span className="audit-provenance">Finance ledger</span>}
        <time dateTime={event.occurredAt}>{formatGuamDate(event.occurredAt, { weekday: 'short' })} · {formatGuamTime(event.occurredAt)}</time>
      </div>
      <h2 id={headingId}>{event.summary}</h2>
      <p className="audit-actor">{actor}{event.actorRole && ` · ${event.actorRole.split(', ').map(auditFieldLabel).join(', ')}`}</p>
      {event.reason && <p className="audit-reason"><strong>Reason</strong> {event.reason}</p>}
      <details className="audit-details">
        <summary>Details</summary>
        {fields.length > 0 ? (
          <table className="audit-diff" aria-labelledby={headingId}>
            <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
            <tbody>
              {fields.map(({ field, before, after }) => (
                <tr key={field}>
                  <th scope="row">{auditFieldLabel(field)}</th>
                  <td>{displayValue(before)}</td>
                  <td>{displayValue(after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>No field changes recorded.</p>}
        <dl className="audit-request">
          <div><dt>Operation ID</dt><dd>{event.operationId}</dd></div>
          {event.routePath && <div><dt>Request</dt><dd>{event.httpMethod} {event.routePath}</dd></div>}
        </dl>
        <button type="button" className="btn secondary small" onClick={() => showOperation(event.operationId)}>Show related changes</button>
      </details>
    </li>
  )
}

export function AdminAuditHistoryPage() {
  const [filters, setFilters] = useState<AdminAuditFilters>({})
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<AdminAuditResponse>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    api.adminAuditEvents({ ...filters, cursor }, abort.signal)
      .then((page) => {
        if (abort.signal.aborted) return
        setData((previous) => ({
          ...page,
          filterOptions: page.filterOptions ?? previous?.filterOptions,
          auditEvents: cursor ? [...(previous?.auditEvents ?? []), ...page.auditEvents] : page.auditEvents,
        }))
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load audit history.')
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })

    return () => abort.abort()
  }, [cursor, filters, retry])

  function replaceFilters(next: AdminAuditFilters) {
    setLoading(true)
    setError(undefined)
    setFilters(next)
    setCursor(null)
  }

  const options = data?.filterOptions
  const scope = filters.tournament_id ? `season:${filters.tournament_id}` : filters.host_campaign_id ? `campaign:${filters.host_campaign_id}` : ''
  const events = data?.auditEvents ?? []
  const showEvents = (Boolean(cursor) || (!loading && !error)) && events.length > 0

  return (
    <div className="page-stack admin-page audit-history">
      <PageHeader title="Audit History" description="See what changed, who made the change, and when it happened. Times are in Guam." />
      <Panel className="audit-filters">
        <form className="audit-search" role="search" onSubmit={(event) => {
          event.preventDefault()
          replaceFilters({ ...filters, q: search.trim() })
        }}>
          <Field label="Search history">
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search changes or people" />
          </Field>
          <button className="btn primary" type="submit">Search</button>
        </form>
        <div className="audit-filter-grid">
          <Field label="Area">
            <select value={filters.area ?? ''} onChange={(event) => replaceFilters({ ...filters, area: event.target.value })}>
              <option value="">All areas</option>
              {options?.areas.map((area) => <option key={area} value={area}>{auditFieldLabel(area)}</option>)}
            </select>
          </Field>
          <Field label="Person">
            <select value={filters.actor_id ?? ''} onChange={(event) => replaceFilters({ ...filters, actor_id: event.target.value })}>
              <option value="">Everyone</option>
              {options?.actors.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Season / Campaign">
            <select value={scope} onChange={(event) => {
              const [kind, id] = event.target.value.split(':')
              replaceFilters({ ...filters, tournament_id: kind === 'season' ? id : undefined, host_campaign_id: kind === 'campaign' ? id : undefined })
            }}>
              <option value="">All seasons and campaigns</option>
              {Boolean(options?.tournaments.length) && <optgroup label="Seasons">
                {options?.tournaments.map(({ id, label }) => <option key={id} value={`season:${id}`}>{label}</option>)}
              </optgroup>}
              {Boolean(options?.campaigns.length) && <optgroup label="Campaigns">
                {options?.campaigns.map(({ id, label }) => <option key={id} value={`campaign:${id}`}>{label}</option>)}
              </optgroup>}
            </select>
          </Field>
          <fieldset className="audit-date-range">
            <legend>Date range</legend>
            <Field label="From">
              <input type="date" value={filters.from ?? ''} max={filters.to || undefined} onChange={(event) => replaceFilters({ ...filters, from: event.target.value })} />
            </Field>
            <Field label="To">
              <input type="date" value={filters.to ?? ''} min={filters.from || undefined} onChange={(event) => replaceFilters({ ...filters, to: event.target.value })} />
            </Field>
          </fieldset>
        </div>
        <div className="audit-filter-actions">
          {filters.operation_id && <span className="audit-area">Related changes</span>}
          <button type="button" className="btn secondary small" onClick={() => {
            setSearch('')
            replaceFilters({})
          }}>Clear filters</button>
        </div>
      </Panel>

      {!cursor && loading && <LoadingState label="Loading audit history" />}
      {showEvents && (
        <Panel className="audit-feed">
          <ol aria-label="Audit events">
            {events.map((event) => <AuditHistoryEntry key={event.id} event={event} showOperation={(operation_id) => {
              setSearch('')
              replaceFilters({ operation_id })
            }} />)}
          </ol>
        </Panel>
      )}
      {!loading && error && <ErrorState message={error} onRetry={() => {
        setLoading(true)
        setError(undefined)
        setRetry((value) => value + 1)
      }} />}
      {!loading && !error && events.length === 0 && <EmptyState title="No changes found" description="Try a different search or clear the filters." />}
      {showEvents && data?.nextCursor && !error && (
        <div className="audit-load-more">
          <button type="button" className="btn secondary" disabled={loading} onClick={() => {
            setLoading(true)
            setCursor(data.nextCursor)
          }}>{loading ? 'Loading more…' : 'Load more'}</button>
        </div>
      )}
    </div>
  )
}
