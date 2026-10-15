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
import StoresPage from "./pages/StoresPage";
import StoreGalleryPage from "./pages/StoreGalleryPage";
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
import { useEffect } from "react";

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

function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  const anyErr = error as any;
  const msg = String(anyErr.message || anyErr.shape?.message || anyErr.data?.message || "").toLowerCase();
  const code = anyErr.data?.code || anyErr.shape?.data?.code;
  if (code === "UNAUTHORIZED") return true;
  if (msg.includes("please login") || msg.includes("10001")) return true;
  // fallback: stringified search
  try {
    const raw = JSON.stringify(error).toLowerCase();
    if (raw.includes("please login") || raw.includes("10001") || raw.includes("unauthorized")) return true;
  } catch {}
  return false;
}

function FeatureProtected({ featureKey, children }: { featureKey: EntitlementKey; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const access = trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    retry: false,
  });

  useEffect(() => {
    if (access.error && isUnauthorizedError(access.error)) {
      // Sessão do cookie não reconhecida no servidor (comum em preview/Vercel).
      // Limpa cache local e manda para login em vez de mostrar "módulo não liberado".
      localStorage.removeItem("promotores-saas-auth-user");
      window.location.replace("/login");
    }
  }, [access.error]);

  if (loading) return <LoadingScreen />;
  if (!user) return <RedirectHome />;
  if (user.role === "platform_admin") return <>{children}</>;

  // Dashboard é a porta de entrada: se o usuário está autenticado no cliente,
  // permite o acesso mesmo se a checagem de entitlement falhar por rede/sessão.
  if (featureKey === "dashboard" && user) {
    if (access.isLoading) return <LoadingScreen />;
    if (access.error && isUnauthorizedError(access.error)) return <LoadingScreen />;
    return <>{children}</>;
  }

  if (access.isLoading) return <LoadingScreen />;

  if (access.error && isUnauthorizedError(access.error)) {
    // Force redirect on render as well (useEffect may lag on mobile/PWA)
    localStorage.removeItem("promotores-saas-auth-user");
    window.location.replace("/login");
    return <LoadingScreen />;
  }

  if (!access.data?.effective[featureKey]) {
    if (featureKey === "timeTracking" && access.data) return <RedirectHome />;
    // Last-resort: if the error message contains login/10001, force redirect
    const errMsg = String((access.error as any)?.message || (access.error as any)?.shape?.message || "").toLowerCase();
    if (errMsg.includes("please login") || errMsg.includes("10001") || isUnauthorizedError(access.error)) {
      localStorage.removeItem("promotores-saas-auth-user");
      window.location.replace("/login");
      return <LoadingScreen />;
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100">
        <section className="max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
          <h1 className="text-xl font-bold">Módulo não liberado</h1>
          <p className="mt-2 text-sm text-slate-300">
            {access.error?.message
              ? access.error.message
              : "Este módulo não está habilitado para sua empresa ou para seu perfil."}
          </p>
          {user.role === "company_admin" ? (
            <a href="/upgrade" className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
              Ver planos disponíveis
            </a>
          ) : (
            <p className="mt-4 text-xs text-slate-400">Peça ao administrador da empresa para revisar seu acesso.</p>
          )}
        </section>
      </main>
    );
  }
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <LandingPage />;
  if (user.role === "platform_admin") return <PlatformDashboard />;
  // Dashboard é a porta de entrada. Não bloqueia por entitlement aqui;
  // se a sessão do cookie estiver inválida, o próprio dashboard ou as
  // chamadas de API redirecionam para login.
  if (user.role === "promoter") return <PromoterDashboard />;
  if (user.companyId) return <OperationsDashboard />;
  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      {/* Rotas públicas do Promotores SaaS */}
      <Route path="/reset">
        {() => {
          try {
            localStorage.removeItem("promotores-saas-auth-user");
            localStorage.removeItem("promotores-saas-session-token");
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => undefined);
            }
            if ("caches" in window) {
              caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => undefined);
            }
          } catch (e) { /* ignore */ }
          setTimeout(() => { window.location.href = "/login"; }, 400);
          return <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white"><p>Limpando cache... redirecionando</p></main>;
        }}
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={SignupPage} />
      <Route path="/planos" component={PublicPlansPage} />
      <Route path="/produtos"><CommercialProtected><ProductsPage /></CommercialProtected></Route>
      <Route path="/lojas/:storeId"><CommercialProtected><FeatureProtected featureKey="fieldOperations"><StoreGalleryPage /></FeatureProtected></CommercialProtected></Route>
      <Route path="/lojas"><CommercialProtected><FeatureProtected featureKey="fieldOperations"><StoresPage /></FeatureProtected></CommercialProtected></Route>
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
