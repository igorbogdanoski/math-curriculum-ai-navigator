import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card } from './Card';
import { ICONS } from '../../constants';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: any;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

  static getDerivedStateFromError(error: any): Partial<ErrorBoundaryState> {
    return { hasError: true, error: error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    this.setState({ errorInfo, error });
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  }

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 
                           (typeof error === 'object' ? JSON.stringify(error) : String(error));
                           
      const errorDetails = `Грешка: ${errorMessage}\n\nStack: ${error instanceof Error ? error.stack : 'N/A'}\n\nComponent Stack:\n${errorInfo?.componentStack || 'N/A'}`;
      
      navigator.clipboard.writeText(errorDetails).then(() => {
        alert('Деталите за грешката се копирани.');
      }).catch(err => {
        console.error("Failed to copy error details:", err);
        alert('Неуспешно копирање.');
      });
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error instanceof Error 
          ? this.state.error.toString() 
          : (typeof this.state.error === 'object' ? JSON.stringify(this.state.error, null, 2) : String(this.state.error));

      return (
        <div className="w-full h-full flex items-center justify-center bg-brand-bg p-4 min-h-screen">
            <Card className="max-w-xl text-center w-full shadow-lg border-red-100">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
                     <ICONS.sparkles className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-2">Настана грешка</h1>
                <p className="text-gray-600 mb-8 text-lg">
                    Се извинуваме, се случи неочекувана грешка при вчитување на компонентата.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button
                        onClick={this.handleRefresh}
                        className="bg-brand-primary text-white px-6 py-3 rounded-lg shadow hover:bg-brand-secondary transition-colors font-semibold"
                    >
                        Освежи ја страницата
                    </button>
                    <button
                        onClick={this.handleCopyError}
                        className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                    >
                        Копирај детали
                    </button>
                </div>

                {this.state.error && (
                    <details className="mt-8 text-left bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs overflow-auto max-h-64">
                        <summary className="cursor-pointer font-medium text-gray-600 mb-2 select-none">Технички детали</summary>
                        <pre className="whitespace-pre-wrap font-mono text-red-700 break-all">
                            {errorMessage}
                            <br />
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                )}
            </Card>
        </div>
      );
    }
    return this.props.children;
  }
}