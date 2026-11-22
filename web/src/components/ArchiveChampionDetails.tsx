import { Link } from 'react-router-dom'
import type { TournamentChampion } from '../lib/types'
import { safeHttpsHref } from '../lib/urls'
import { IconExternal, IconPlay } from './Icons'

type ChampionDetails = Pick<TournamentChampion, 'sourceUrl' | 'mvpName' | 'mvpNote' | 'highlightVideoId'>

export function ArchiveChampionDetails({ record, highlightHref }: { record: ChampionDetails; highlightHref?: string }) {
  const source = safeHttpsHref(record.sourceUrl)
  const { mvpName, mvpNote } = record

  return (
    <>
      {(mvpName || mvpNote) && <p className="archive-mvp"><strong>{mvpName ? 'MVP / Player of the Game' : 'Player highlights'}</strong> {mvpName}{mvpName && mvpNote ? ' · ' : ''}{mvpNote}</p>}
      {(source || (record.highlightVideoId && highlightHref)) && (
        <div className="archive-source-links">
          {source && <a href={source} target="_blank" rel="noreferrer">Source <IconExternal /></a>}
          {record.highlightVideoId && highlightHref && <Link to={highlightHref}>Highlight video <IconPlay size={15} /></Link>}
        </div>
      )}
    </>
  )
}
