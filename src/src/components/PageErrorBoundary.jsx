import React from 'react'
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react'

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) {
    console.error('RestaPay page render failure', error, info)
    window.dispatchEvent(new CustomEvent('restapay:page-error', { detail: { message: error?.message || 'Unknown page error' } }))
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return <div className="page-error-state card-surface">
      <AlertTriangle size={34}/>
      <h2>This page could not be loaded</h2>
      <p>{this.state.error.message || 'A record contains an unsupported or missing value.'}</p>
      <div className="page-error-actions">
        <button className="primary-button" onClick={() => window.location.reload()}><RotateCcw size={16}/>Retry</button>
        <button className="secondary-action" onClick={() => { window.location.href='/dashboard' }}><LayoutDashboard size={16}/>Dashboard</button>
      </div>
    </div>
  }
}
