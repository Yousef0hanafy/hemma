"use client";

import React, { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches render errors in its children tree
 * and displays a user-friendly fallback UI instead of crashing the whole app.
 *
 * Automatically reports errors to Sentry if the SDK is available.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);

    // Report to Sentry if the SDK is installed (dynamic import avoids bundle bloat)
    this.reportToSentry(error, errorInfo);
  }

  /** Dynamically import Sentry and report the error — no-op if SDK not installed. */
  private async reportToSentry(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, {
        tags: { source: "error-boundary" },
        extra: {
          componentStack: errorInfo.componentStack,
          componentName: extractComponentName(errorInfo.componentStack),
        },
      });
    } catch {
      // @sentry/nextjs not installed — silently skip
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-6 py-12 text-center"
          role="alert"
        >
          <div className="h-14 w-14 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold mb-1">
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              تعذر عرض هذا القسم. قد يكون هناك خلل مؤقت. حاول إعادة التحميل أو
              ارجع إلى الصفحة الرئيسية.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={this.handleRetry}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>إعادة المحاولة</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (typeof window !== "undefined") {
                  window.location.hash = "";
                  window.location.reload();
                }
              }}
            >
              العودة للرئيسية
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-4 w-full max-w-lg text-left" dir="ltr">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                تفاصيل الخطأ (للتَطْوِير)
              </summary>
              <pre className="mt-2 text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the innermost component name from a React component stack string.
 * Example input: "at MyComponent (webpack-internal:///...)"
 * Example output: "MyComponent"
 */
function extractComponentName(componentStack: string): string | undefined {
  const match = componentStack.match(/at\s+([\w]+)/);
  return match?.[1] ?? undefined;
}
