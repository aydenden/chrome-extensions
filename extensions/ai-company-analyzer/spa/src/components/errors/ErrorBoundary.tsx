import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => { this.setState({ hasError: false, error: null }); };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="max-w-md text-center p-8">
            <h1 className="headline text-3xl mb-4">오류가 발생했습니다</h1>
            <p className="text-ink-muted mb-4">예기치 않은 오류가 발생했습니다.</p>
            {this.state.error && (
              <pre className="bg-surface-sunken p-4 text-sm text-left overflow-auto mb-6 font-mono">{this.state.error.message}</pre>
            )}
            <Button onClick={this.handleRetry}>다시 시도</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
