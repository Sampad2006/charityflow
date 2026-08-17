import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-12 max-w-lg rounded-2xl border border-coral/30 bg-paper p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-coral/10 text-xl text-coral">
            ⚠️
          </div>
          <h2 className="font-display text-xl font-bold text-ink-900">Something went wrong</h2>
          <p className="mt-2 text-xs text-ink-500">
            An unexpected error occurred. The application has safely caught it.
          </p>
          <div className="mt-4 rounded-lg bg-ink-50 p-3 text-left font-mono text-[11px] text-coral">
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={this.handleReset}
            className="mt-6 rounded-xl bg-ink-900 px-6 py-2.5 text-xs font-semibold text-paper transition-transform hover:scale-105"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
