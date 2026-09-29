import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('pakpost_offices');
      localStorage.removeItem('pakpost_reports');
      localStorage.removeItem('pakpost_users');
      localStorage.removeItem('pakpost_user');
      localStorage.removeItem('pakpost_whatsapp');
      localStorage.removeItem('pakpost_triggers');
      localStorage.removeItem('pakpost_holidays');
      localStorage.removeItem('pakpost_auto_refresh');
    } catch (e) {
      console.warn('Could not clear local storage', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-xl shadow-lg border border-red-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                سسٹم میں عارضی خرابی پیش آئی ہے
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Pakistan Post Daily Delivery Reporting System
              </p>
            </div>

            <p className="text-sm text-gray-600">
              براہ کرم صفحہ دوبارہ لوڈ کریں یا لوکل ڈیٹا کیچ صاف کر کے کوشش کریں۔
            </p>

            {this.state.error && (
              <div className="bg-gray-100 p-3 rounded-lg text-left text-xs font-mono text-red-700 overflow-x-auto max-h-36">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00401A] hover:bg-[#003014] text-white rounded-lg font-medium text-sm transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                صفحہ دوبارہ لوڈ کریں (Reload)
              </button>

              <button
                onClick={this.handleResetCache}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                کیچ صاف کریں (Reset Cache)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
