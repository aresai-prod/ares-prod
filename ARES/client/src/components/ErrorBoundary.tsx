import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: string | null;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error?.message ?? "Unexpected error" };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("ARES render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(48,82,92,0.2)",
              borderRadius: 18,
              padding: 20,
              color: "#20323b",
              boxShadow: "0 18px 40px rgba(32,50,59,0.12)"
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>ARES encountered an error</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {this.state.error}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
              Refresh the page. If this persists, open DevTools Console and share the error text.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
