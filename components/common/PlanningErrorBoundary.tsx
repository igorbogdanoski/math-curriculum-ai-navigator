import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error fallback (e.g. "Планот за час") */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PlanningErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[PlanningErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.label ?? 'Планот';

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center min-h-[300px] p-8 gap-4 text-center"
      >
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h2 className="text-lg font-bold text-slate-800">
          {label} не може да се вчита
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Настана неочекувана грешка. Обидете се повторно или превчитајте ја страницата.
        </p>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <pre className="text-xs text-red-500 bg-red-50 rounded p-3 max-w-xl overflow-auto text-left">
            {this.state.error.message}
          </pre>
        )}
        <button
          onClick={this.handleReset}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-4 h-4" />
          Обиди се повторно
        </button>
      </div>
    );
  }
}
