import { Component } from 'react';
import { Navigate } from 'react-router-dom';

export class ErrorBoundary403 extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      if (error?.status === 403) {
        return <Navigate to={`/unauthorized?key=${encodeURIComponent(error.permissionKey || '')}`} replace />;
      }
    }
    return this.props.children;
  }
}

export default ErrorBoundary403;
