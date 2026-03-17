/**
 * Compact, inline ErrorBoundary designed for tab-level isolation.
 *
 * Usage:
 *   <TabErrorBoundary key={activeTab} tabName={activeTab}>
 *     {activeTab === 'overview' && <OverviewTab ... />}
 *     ...
 *   </TabErrorBoundary>
 *
 * The key={activeTab} prop causes React to unmount+remount this boundary
 * whenever the tab changes, so a crash in one tab never bleeds into another.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureException } from '../../services/sentryService';

interface Props {
  children: ReactNode;
  /** Tab identifier shown in the error UI and logged for debugging */
  tabName?: string;
}

interface State {
  hasError: boolean;
  error?: unknown;
}

export class TabErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[TabErrorBoundary:${this.props.tabName ?? 'unknown'}]`, error, info);
    captureException(error instanceof Error ? error : new Error(String(error)), {
      componentStack: info.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error instanceof Error
      ? this.state.error.message
      : String(this.state.error);

    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <p className="font-semibold text-gray-800 mb-1">Грешка при прикажување на табот</p>
        <p className="text-sm text-gray-500 mb-5 max-w-sm">
          Овој таб наиде на неочекувана грешка. Другите табови функционираат нормално.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обиди се повторно
        </button>
        <details className="mt-6 text-left w-full max-w-sm">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">Технички детали</summary>
          <pre className="mt-2 text-xs font-mono text-red-600 bg-red-50 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap break-all">
            {msg}
          </pre>
        </details>
      </div>
    );
  }
}
