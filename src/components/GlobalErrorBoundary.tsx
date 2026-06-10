import React from "react";
import { reportError } from "@/lib/errorReporter";

interface State {
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, { componentStack: info.componentStack }, "react.errorBoundary");
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-lg w-full border border-border rounded-lg p-6 bg-card text-card-foreground space-y-4">
            <h1 className="text-xl font-semibold">화면을 표시하는 중 오류가 발생했습니다</h1>
            <p className="text-sm text-muted-foreground">
              오류는 자동으로 기록되었습니다. 페이지를 새로고침해 주세요.
            </p>
            <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded max-h-48 overflow-auto">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
              >
                새로고침
              </button>
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                계속 시도
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default GlobalErrorBoundary;
