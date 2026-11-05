import { Component, ReactNode } from "react";

interface Props { children: ReactNode; resetKey?: string; }
interface State { hasError: boolean; error: Error | null; resetKey?: string; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    return null;
  }
  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07111f", color: "#fff", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Esta tela não abriu</h2>
            <p style={{ color: "#94a3b8", marginBottom: 20 }}>O restante do aplicativo continua disponível. Volte ao painel ou tente de novo.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/" style={{ background: "#2dd4bf", color: "#0f172a", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>Voltar ao painel</a>
              <button onClick={() => this.setState({ hasError: false, error: null })} style={{ background: "transparent", color: "#fff", border: "1px solid #334155", padding: "10px 16px", borderRadius: 8 }}>Tentar de novo</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
