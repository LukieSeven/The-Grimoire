import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.href = import.meta.env.BASE_URL || "/";
  };

  private handleClearCacheAndReload = () => {
    try {
      sessionStorage.clear();
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch (e) {
      console.error(e);
    }
    window.location.href = import.meta.env.BASE_URL || "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-card border border-border/60 shadow-2xl p-6 rounded-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-xl font-bold text-primary">An Archive Anomaly Occurred</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Grimoire encountered an unexpected error while reading the archive.
            </p>
            {this.state.error && (
              <div className="bg-background/80 p-3 rounded text-[10px] font-mono text-destructive text-left overflow-x-auto max-h-32 border border-border/40">
                {this.state.error.message}
              </div>
            )}
            <div className="pt-2 flex flex-wrap gap-3 justify-center">
              <Button
                onClick={this.handleReload}
                className="bg-primary text-primary-foreground font-serif text-xs px-4 py-2 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Grimoire
              </Button>
              <Button
                variant="outline"
                onClick={this.handleClearCacheAndReload}
                className="border-border text-muted-foreground hover:text-foreground font-serif text-xs px-4 py-2 rounded flex items-center gap-1.5 cursor-pointer"
              >
                Clear Cache & Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
