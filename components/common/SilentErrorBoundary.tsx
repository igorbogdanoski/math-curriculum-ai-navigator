import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface SilentErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface SilentErrorBoundaryState {
  hasError: boolean;
}

/**
 * A lightweight ErrorBoundary that silently catches errors and renders
 * a minimal fallback instead of crashing the entire app.
 * Use for non-critical UI sections like Sidebar, FAB, AI panels.
 */
export class SilentErrorBoundary extends Component<SilentErrorBoundaryProps, SilentErrorBoundaryState> {
  declare props: Readonly<SilentErrorBoundaryProps>;
  public state: SilentErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): Partial<SilentErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SilentErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
