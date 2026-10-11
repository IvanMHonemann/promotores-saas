import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import MyAccountPage from "./pages/MyAccountPage";
import AuditPage from "./pages/AuditPage";
import PromoterDashboard from "./pages/promoter/PromoterDashboard";
import PromoterClockPage from "./pages/promoter/PromoterClockPage";
import OperationsDashboard from "./pages/operations/OperationsDashboard";
import ProductsPage from "./pages/ProductsPage";
import TrashPage from "./pages/TrashPage";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { EntitlementKey } from "@shared/entitlements";

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

function PromoterProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "promoter") return <RedirectHome />;
  return <>{children}</>;
}

function FeatureProtected({ featureKey, children }: { featureKey: EntitlementKey; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const access = trpc.entitlements.mine.useQuery(undefined, { enabled: Boolean(user && user.role !== "platform_admin") });
  if (loading) return <LoadingScreen />;
  if (!user) return <RedirectHome />;
  if (user.role === "platform_admin") return <>{children}</>;
  if (access.isLoading) return <LoadingScreen />;
  if (!access.data?.effective[featureKey]) {
    if (featureKey === "timeTracking" && access.data) return <RedirectHome />;
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100"><section className="max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-center"><h1 className="text-xl font-bold">Módulo não liberado</h1><p className="mt-2 text-sm text-slate-300">{access.error?.message || "Este módulo não está habilitado para sua empresa ou para seu perfil."}</p>{user.role === "company_admin" ? <a href="/upgrade" className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Ver planos disponíveis</a> : <p className="mt-4 text-xs text-slate-400">Peça ao administrador da empresa para revisar seu acesso.</p>}</section></main>;
  }
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <LandingPage />;
  if (user.role === "platform_admin") return <PlatformDashboard />;
  if (user.role === "promoter") return <FeatureProtected featureKey="dashboard"><PromoterDashboard /></FeatureProtected>;
  if (user.companyId) return <FeatureProtected featureKey="dashboard"><OperationsDashboard /></FeatureProtected>;
  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      {/* Rotas públicas do Promotores SaaS */}
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={SignupPage} />
      <Route path="/planos" component={PublicPlansPage} />
      <Route path="/produtos"><CommercialProtected><ProductsPage /></CommercialProtected></Route>
      <Route path="/lixeira"><CompanyAdminProtected><TrashPage /></CompanyAdminProtected></Route>
      <Route path="/ponto"><PromoterProtected><FeatureProtected featureKey="timeTracking"><PromoterClockPage /></FeatureProtected></PromoterProtected></Route>
      {/* Raiz: visitante → landing; autenticado → painel conforme o perfil */}
      <Route path="/"><RootRoute /></Route>
      <Route path="/admin/usuarios"><AdminProtected><FeatureProtected featureKey="teamManagement"><AdminUsersPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/admin/assinaturas"><AdminProtected><AdminAssinaturasPage /></AdminProtected></Route>
      <Route path="/conta/planos"><CompanyAdminProtected><PlansPage /></CompanyAdminProtected></Route>
      <Route path="/upgrade"><CompanyAdminProtected><UpgradePlanPage /></CompanyAdminProtected></Route>
      <Route path="/minha-assinatura"><CompanyAdminProtected><MySubscriptionPage /></CompanyAdminProtected></Route>
      <Route path="/pagamentos"><CompanyAdminProtected><PaymentHistoryPage /></CompanyAdminProtected></Route>
      <Route path="/minha-conta"><AdminProtected><MyAccountPage /></AdminProtected></Route>
      <Route path="/auditoria"><CompanyAdminProtected><FeatureProtected featureKey="reports"><AuditPage /></FeatureProtected></CompanyAdminProtected></Route>
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
