import { Link } from 'react-router-dom'
import { Panel } from '../../components/ui'
import { useSiteMode } from '../../contexts/SiteModeContext'

export function NotFoundPage() {
  const { siteMode } = useSiteMode()
  const seasonal = siteMode.navItems.find(({ to }) => to !== '/' && to !== '/history')
  return (
    <Panel>
      <h1>Page not found</h1>
      <p>The link may have changed or the page may have moved.</p>
      <div className="hero-actions">
        <Link className="btn primary" to="/">Home</Link>
        <Link className="btn secondary" to="/history">History</Link>
        {seasonal && <Link className="btn secondary" to={seasonal.to}>{seasonal.label}</Link>}
      </div>
    </Panel>
  )
}
