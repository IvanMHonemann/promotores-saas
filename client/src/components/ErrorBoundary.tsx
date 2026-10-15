import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07111f", color: "#fff", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Algo deu errado</h2>
            <p style={{ color: "#94a3b8", marginBottom: 20 }}>A página encontrou um erro. Limpe o cache e tente de novo.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <a href="/reset" style={{ background: "#2dd4bf", color: "#0f172a", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>Limpar e entrar</a>
              <button onClick={() => window.location.reload()} style={{ background: "transparent", color: "#fff", border: "1px solid #334155", padding: "10px 16px", borderRadius: 8 }}>Recarregar</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
