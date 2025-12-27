import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LearnKids] Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <div className="error-emoji">😅</div>
          <h2>Oops! Something went wrong</h2>
          <p>Let's start fresh!</p>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            🔄 Restart
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mount the app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('[LearnKids] Widget initialized! 🚀');
}
