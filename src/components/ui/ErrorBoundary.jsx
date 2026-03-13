import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 640, margin: '32px auto', textAlign: 'center' }}>
          <div className="card__title" style={{ justifyContent: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            Something went wrong
          </div>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            A UI error occurred. Try reloading the page or go back to the dashboard.
          </p>
          {this.state.error?.message && (
            <div className="error-box" style={{ textAlign: 'left' }}>
              {this.state.error.message}
            </div>
          )}
          <button className="btn-primary" onClick={this.handleReload}>
            <RefreshCw size={14} /> Reload
          </button>
        </div>
      </div>
    );
  }
}
