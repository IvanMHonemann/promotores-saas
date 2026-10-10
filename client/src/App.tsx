import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PrintOrderPage from "./pages/PrintOrderPage";
import LandingPage from "./pages/LandingPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminAssinaturasPage from "./pages/AdminAssinaturasPage";
import PlansPage from "./pages/PlansPage";
import PublicPlansPage from "./pages/PublicPlansPage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import UpgradePlanPage from "./pages/UpgradePlanPage";
import MySubscriptionPage from "./pages/MySubscriptionPage";
import PaymentHistoryPage from "./pages/PaymentHistoryPage";
import BackupPage from "./pages/BackupPage";
import SyncStatusPage from "./pages/SyncStatusPage";
import AuditPage from "./pages/AuditPage";
import PromoterDashboard from "./pages/promoter/PromoterDashboard";
import OperationsDashboard from "./pages/operations/OperationsDashboard";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function RedirectHome() { if (typeof window !== "undefined") window.location.replace("/"); return <LoadingScreen />; }

function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-7 w-7 animate-spin text-red-500" /></div>; }

function CommercialProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "platform_admin" || !user.companyId) return <RedirectHome />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <RedirectHome />;
  return <>{children}</>;
}

/** Somente administrador da empresa (não operador/técnico). */
function CompanyAdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "company_admin") return <RedirectHome />;
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <LandingPage />;
  if (user.role === "platform_admin") return <PlatformDashboard />;
  if (user.role === "promoter") return <PromoterDashboard />;
  if (user.companyId) return <OperationsDashboard />;
  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      {/* Rotas públicas do Promotores SaaS */}
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={SignupPage} />
      <Route path="/planos" component={PublicPlansPage} />
      {/* Raiz: visitante → landing; autenticado → painel conforme o perfil */}
      <Route path="/"><RootRoute /></Route>
      <Route path="/admin/usuarios"><AdminProtected><AdminUsersPage /></AdminProtected></Route>
      <Route path="/admin/assinaturas"><AdminProtected><AdminAssinaturasPage /></AdminProtected></Route>
      <Route path="/conta/planos"><CompanyAdminProtected><PlansPage /></CompanyAdminProtected></Route>
      <Route path="/upgrade"><CompanyAdminProtected><UpgradePlanPage /></CompanyAdminProtected></Route>
      <Route path="/minha-assinatura"><CompanyAdminProtected><MySubscriptionPage /></CompanyAdminProtected></Route>
      <Route path="/pagamentos"><CompanyAdminProtected><PaymentHistoryPage /></CompanyAdminProtected></Route>
      <Route path="/backup"><CommercialProtected><BackupPage /></CommercialProtected></Route>
      <Route path="/auditoria"><CompanyAdminProtected><AuditPage /></CompanyAdminProtected></Route>
      <Route path="/sync-status"><CommercialProtected><SyncStatusPage /></CommercialProtected></Route>
      <Route path="/os/:id"><CommercialProtected><PrintOrderPage /></CommercialProtected></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PwaStatusBar />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
