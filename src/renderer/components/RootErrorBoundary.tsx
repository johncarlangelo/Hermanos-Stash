import { Component } from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort boundary around the entire app. A render crash must never
 * present as a silent black screen — the user always gets an explanation
 * and a way to recover.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught renderer error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 bg-base px-8 text-center"
        >
          <p className="text-[15px] font-medium text-ink">The interface hit an unexpected error.</p>
          <p className="max-w-md font-mono text-[11.5px] leading-relaxed break-words text-faint">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 cursor-pointer rounded-md border border-line-strong bg-surface px-4 py-2 text-[13px] text-ink transition-colors duration-150 hover:bg-raised"
          >
            Reload Stash
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
