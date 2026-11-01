import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches render errors so a broken panel shows a friendly retry instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error('[Koog] panel crashed', err, info.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div role="alert" style={{ margin: '40px auto', maxWidth: 420, padding: 20, textAlign: 'center', borderRadius: 16, background: '#1b1832', color: '#f4f2ff', border: '1px solid rgba(255,255,255,.2)' }}>
        <p style={{ fontSize: 18, fontWeight: 800, margin: '0 0 10px' }}>Oops, something broke{this.props.label ? ' in ' + this.props.label : ''}.</p>
        <button type="button" style={{ font: 'inherit', fontWeight: 800, padding: '10px 18px', borderRadius: 999, cursor: 'pointer' }}
          onClick={() => this.setState({ err: null })}>Tap to reload this panel</button>
      </div>
    )
  }
}
