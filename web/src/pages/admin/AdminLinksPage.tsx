import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { externalHref } from '../../lib/urls'
import type { Game, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

export function AdminLinksPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [drafts, setDrafts] = useState<Record<string, { ticketUrl: string; streamUrl: string }>>({})
  const [message, setMessage] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, links] = await Promise.all([api.adminTournaments(), api.adminLinks(tournamentId || null)])
    return { tournaments: tournaments.tournaments, games: links.games, tournament: links.tournament }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  useEffect(() => {
    const next: Record<string, { ticketUrl: string; streamUrl: string }> = {}
    data?.games.forEach((game) => { next[game.id] = { ticketUrl: game.ticketUrl || '', streamUrl: game.streamUrl || '' } })
    setDrafts(next)
  }, [data?.games])

  const save = async () => {
    const updates = (data?.games || [])
      .filter((game) => drafts[game.id] && (drafts[game.id].ticketUrl !== (game.ticketUrl || '') || drafts[game.id].streamUrl !== (game.streamUrl || '')))
      .map((game) => ({ id: game.id, ticketUrl: externalHref(drafts[game.id].ticketUrl), streamUrl: externalHref(drafts[game.id].streamUrl) }))

    if (!updates.length) {
      setMessage('No link changes to save')
      return
    }

    try {
      const response = await api.adminBulkLinks(updates)
      setMessage(`Saved ${response.updated} link updates`)
      await reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save links')
    }
  }

  if (loading && !data) return <LoadingState label="Loading links" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Ticket and stream links" description="Paste GuamTime ticket links and Clutch or partner stream links for each scheduled game." actions={<button className="btn primary" onClick={save}>Save changes</button>} />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      {message && <Panel className="notice-panel">{message}</Panel>}
      <Panel>
        {!data?.games.length ? <EmptyState title="No games found" description="Create games before attaching ticket and stream links." /> : <div className="admin-list">{data.games.map((game) => <LinkRow key={game.id} game={game} value={drafts[game.id] || { ticketUrl: '', streamUrl: '' }} onChange={(value) => setDrafts((prev) => ({ ...prev, [game.id]: value }))} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function LinkRow({ game, value, onChange }: { game: Game; value: { ticketUrl: string; streamUrl: string }; onChange: (value: { ticketUrl: string; streamUrl: string }) => void }) {
  return <article className="admin-row-card"><div className="admin-row-head"><div><strong>{game.awayTeam?.displayName} at {game.homeTeam?.displayName}</strong><span>{formatGuamDateTime(game.startTime)}</span></div></div><FormGrid><Field label="GuamTime ticket URL"><input value={value.ticketUrl} onChange={(event) => onChange({ ...value, ticketUrl: event.target.value })} /></Field><Field label="Clutch / stream URL"><input value={value.streamUrl} onChange={(event) => onChange({ ...value, streamUrl: event.target.value })} /></Field></FormGrid></article>
}
