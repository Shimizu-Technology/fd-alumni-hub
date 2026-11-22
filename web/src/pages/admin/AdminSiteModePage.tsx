import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SeasonHero } from '../../components/SeasonHero'
import { LoadingState, Panel, SectionUnavailable } from '../../components/ui'
import { api } from '../../lib/api'
import { formatGuamDateTime } from '../../lib/datetime'
import { useAsync } from '../../lib/hooks'
import { sectionLabels, siteModes, type SiteModeAdmin, type SiteModeName, type SiteModePreview, type SiteModeSettings, type SiteSection } from '../../lib/siteMode'

function draftFrom({ current, siteMode, campaigns }: SiteModeAdmin): SiteModeSettings {
  return {
    mode: current?.mode ?? siteMode.mode,
    tournamentId: current ? current.tournamentId : siteMode.tournament?.id ?? null,
    hostCampaignId: current ? current.hostCampaignId : campaigns.find((campaign) => campaign.slug === siteMode.hostCampaign?.slug)?.id ?? null,
    sectionOverrides: current?.sectionOverrides ?? {},
    publishSchedule: false,
    recapHeadline: current?.recapHeadline ?? '',
    recapSummary: current?.recapSummary ?? '',
    handoffBannerEnabled: current?.handoffBannerEnabled ?? false,
  }
}

export function AdminSiteModePage() {
  const [params] = useSearchParams()
  const { data, error, reload } = useAsync(api.adminSiteMode)
  if (!data) return error ? <SectionUnavailable title="Site Mode is unavailable" description={error} onRetry={reload} /> : <LoadingState label="Loading Site Mode" />
  const initial = draftFrom(data)
  const tournament = data.tournaments.find((entry) => entry.id === params.get('tournamentId'))
  const hostCampaign = data.campaigns.find((entry) => entry.id === params.get('hostCampaignId'))
  if (data.current?.mode !== 'tournament_recap' || data.current.tournamentId !== tournament?.id) {
    if (params.get('mode') === 'tournament_recap' && tournament) {
      Object.assign(initial, { mode: 'tournament_recap', tournamentId: tournament.id, recapHeadline: '', recapSummary: '', sectionOverrides: {} })
    }
  }
  if (params.get('mode') === 'fundraising' && hostCampaign) {
    Object.assign(initial, { mode: 'fundraising', hostCampaignId: hostCampaign.id, sectionOverrides: {} })
  }
  return <SiteModeEditor key={`${data.current?.id || 'initial'}:${params.toString()}`} initial={initial} configuration={data} reload={reload} />
}

function SiteModeEditor({ configuration, initial, reload }: { configuration: SiteModeAdmin; initial: SiteModeSettings; reload: () => Promise<void> }) {
  const { siteMode, tournaments, campaigns, actions, history, suggestedMode } = configuration
  const [draft, setDraft] = useState(initial)
  const [preview, setPreview] = useState<SiteModePreview | null>(null)
  const [phone, setPhone] = useState(true)
  const [error, setError] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [busy, setBusy] = useState(false)
  const season = tournaments.find((entry) => entry.id === draft.tournamentId)

  useEffect(() => {
    const request = new AbortController()
    setPreview(null)
    setPreviewError('')
    const timer = window.setTimeout(() => {
      api.previewSiteMode(draft, request.signal).then((result) => {
        if (!request.signal.aborted) setPreview(result)
      }).catch((err: unknown) => {
        if (!request.signal.aborted) setPreviewError(err instanceof Error ? err.message : 'Could not load the preview.')
      })
    }, 180)
    return () => {
      window.clearTimeout(timer)
      request.abort()
    }
  }, [draft])

  function update(change: Partial<SiteModeSettings>) {
    setDraft((previous) => ({ ...previous, ...change }))
  }

  async function save(operation: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await operation()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the site mode.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <Panel>
        <h1>Site Mode</h1>
        <p><strong>Live · {siteModes[siteMode.mode]}</strong> · {siteMode.tournament?.year || 'No selected season'} · {siteMode.hostCampaign?.hostClass?.displayName || siteMode.hostCampaign?.title || 'No active host class'}</p>
        <p>{siteMode.publishedAt
          ? `Version ${siteMode.versionNumber} · ${formatGuamDateTime(siteMode.publishedAt)}${siteMode.publishedByName ? ` · ${siteMode.publishedByName}` : ''}`
          : 'The site is using its default mode.'}</p>
      </Panel>

      <Panel>
        <fieldset disabled={busy} className="season-editor">
          <legend>Choose a mode</legend>
          <div className="season-fields" role="group" aria-label="Seasonal mode">
            {(Object.entries(siteModes) as [SiteModeName, string][]).map(([value, label]) => (
              <button className={`btn ${value === draft.mode ? 'primary' : 'secondary'}`} type="button" key={value} aria-pressed={value === draft.mode} onClick={() => update({ mode: value })}>
                {label}{value === suggestedMode && <small className="season-suggestion">Suggested</small>}
              </button>
            ))}
          </div>
          <div className="season-fields">
            <label>Season<select value={draft.tournamentId ?? ''} onChange={(event) => update({ tournamentId: event.target.value || null, publishSchedule: false })}>
              <option value="">No season</option>
              {tournaments.map((entry) => <option value={entry.id} key={entry.id}>{entry.year} · {entry.name} · {entry.gameCount} games{entry.schedulePublished ? '' : ' · draft'}</option>)}
            </select></label>
            <label>Host class<select value={draft.hostCampaignId ?? ''} onChange={(event) => update({ hostCampaignId: event.target.value || null })}>
              <option value="">No host campaign</option>
              {campaigns.map((entry) => <option value={entry.id} key={entry.id}>{entry.hostClass || entry.title} · {entry.status}</option>)}
            </select></label>
          </div>
          {season && !season.schedulePublished && <label className="season-check"><input type="checkbox" checked={draft.publishSchedule} onChange={(event) => update({ publishSchedule: event.target.checked })} />Publish schedule with this update</label>}
          {draft.mode === 'tournament_recap' && (
            <>
              <label>Recap headline<input value={draft.recapHeadline} onChange={(event) => update({ recapHeadline: event.target.value })} /></label>
              <label>Recap summary<textarea value={draft.recapSummary} onChange={(event) => update({ recapSummary: event.target.value })} /></label>
              <label className="season-check"><input type="checkbox" checked={draft.handoffBannerEnabled} onChange={(event) => update({ handoffBannerEnabled: event.target.checked })} />Show incoming class handoff banner</label>
            </>
          )}
          <details>
            <summary>Customize sections</summary>
            <div className="season-fields">
              {(Object.entries(sectionLabels) as [SiteSection, string][]).map(([section, label]) => (
                <label key={section}>{label}
                  <select value={draft.sectionOverrides[section] || 'auto'} onChange={(event) => update({ sectionOverrides: { ...draft.sectionOverrides, [section]: event.target.value } })}>
                    <option value="auto">Automatic</option><option value="show">Show</option><option value="hide">Hide</option>
                  </select>
                </label>
              ))}
            </div>
          </details>
        </fieldset>
      </Panel>

      <Panel>
        <div className="section-heading">
          <h2>Preview</h2>
          <div className="section-actions">
            <button type="button" className={`btn small ${phone ? 'primary' : 'secondary'}`} aria-pressed={phone} onClick={() => setPhone(true)}>Phone (390px)</button>
            <button type="button" className={`btn small ${phone ? 'secondary' : 'primary'}`} aria-pressed={!phone} onClick={() => setPhone(false)}>Desktop</button>
          </div>
        </div>
        {previewError && <p role="alert">{previewError}</p>}
        {!preview && !previewError && <p role="status">Updating preview…</p>}
        {preview && (
          <>
            <div className={`season-preview${phone ? ' season-preview-phone' : ''}`} inert>
              <nav aria-label="Preview navigation">
                {(phone ? preview.previewSiteMode.mobileBottomNav : preview.previewSiteMode.navItems).map(({ label }) => <span key={label}>{label}</span>)}
              </nav>
              <SeasonHero siteMode={preview.previewSiteMode} />
              <ul>{(Object.keys(sectionLabels) as SiteSection[]).filter((key) => preview.previewSiteMode.sections[key]).map((key) => <li key={key}>{sectionLabels[key]}</li>)}</ul>
            </div>
            {preview.warnings.length > 0 && <div><h3>Missing content</h3><ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
            <h3>What will change</h3>
            {preview.changes.appearing.length === 0 && preview.changes.disappearing.length === 0
              ? <p>Section visibility stays the same.</p>
              : <ul>
                  {preview.changes.appearing.map((section) => <li key={section}>Show {sectionLabels[section]}</li>)}
                  {preview.changes.disappearing.map((section) => <li key={section}>Hide {sectionLabels[section]}</li>)}
                </ul>}
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="button" className="btn primary" disabled={busy || !preview || !actions.includes('publish')} onClick={() => void save(() => api.publishSiteMode(draft))}>Publish change</button>
      </Panel>

      <Panel>
        <h2>Recent publications</h2>
        {history.length === 0 && <p>No publications yet.</p>}
        <ul className="compact-list season-team-list">
          {history.map((entry) => <li className="compact-row" key={entry.id}>
            <strong>v{entry.versionNumber} · {siteModes[entry.mode]}</strong>
            <span>{formatGuamDateTime(entry.publishedAt)}{entry.publishedByName && ` · ${entry.publishedByName}`}</span>
            <button type="button" className="btn secondary small" aria-label={`Restore version ${entry.versionNumber}`} disabled={busy || !actions.includes('restore')} onClick={() => void save(() => api.restoreSiteMode(entry.id))}>Restore</button>
          </li>)}
        </ul>
      </Panel>
    </div>
  )
}
