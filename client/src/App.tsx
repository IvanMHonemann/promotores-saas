import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { BusyProvider } from "./components/BusyOverlay";

// Code-splitting: cada página vira um chunk carregado sob demanda.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
// SignupPage arquivada em _archived
const MyAccountPage = lazy(() => import("./pages/MyAccountPage"));
const CompanyModulesPage = lazy(() => import("./pages/CompanyModulesPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const PromoterDashboard = lazy(() => import("./pages/promoter/PromoterDashboard"));
const PromoterClockPage = lazy(() => import("./pages/promoter/PromoterClockPage"));
const OperationsDashboard = lazy(() => import("./pages/operations/OperationsDashboard"));
const PlatformDashboard = lazy(() => import("./pages/platform/PlatformDashboard"));
const StoresPage = lazy(() => import("./pages/StoresPage"));
const StoreGalleryPage = lazy(() => import("./pages/StoreGalleryPage"));
const TimesheetPage = lazy(() => import("./pages/admin/TimesheetPage"));
const TimesheetMirrorPage = lazy(() => import("./pages/admin/TimesheetMirrorPage"));
const CheckInOutPage = lazy(() => import("./pages/admin/CheckInOutPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const PlatformCompaniesPage = lazy(() => import("./pages/platform/PlatformCompaniesPage"));
const PlatformAuditPage = lazy(() => import("./pages/platform/PlatformAuditPage"));
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cacheGet, cacheSet, isOnline } from "@/lib/offlineCache";
import { usePhotoSync } from "@/hooks/usePhotoSync";
import { useStoreSync } from "@/hooks/useStoreSync";
import { useClientSync } from "@/hooks/useClientSync";
import { useVisitSync } from "@/hooks/useVisitSync";
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

function PlatformProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "platform_admin") return <RedirectHome />;
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
  const accessQuery = trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    retry: false,
  });
  // Cache entitlements for offline
  const cachedEntitlements = cacheGet<any>("entitlements");
  if (accessQuery.data) cacheSet("entitlements", accessQuery.data);
  const access = {
    ...accessQuery,
    data: accessQuery.data ?? (!isOnline() ? cachedEntitlements : undefined),
  };

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

  // Dashboard e operações de campo: se o usuário está autenticado,
  // permite o acesso mesmo se a checagem falhar (offline ou erro de rede).
  if ((featureKey === "dashboard" || featureKey === "fieldOperations") && user) {
    if (access.isLoading && isOnline()) return <LoadingScreen />;
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
    // Offline: se temos cache de entitlements, permite acesso
    if (!isOnline() && cachedEntitlements?.effective) {
      return <>{children}</>;
    }
    // Last-resort: if the error message contains login/10001, force redirect
    const errMsg = String((access.error as any)?.message || (access.error as any)?.shape?.message || "").toLowerCase();
    if (errMsg.includes("please login") || errMsg.includes("10001") || isUnauthorizedError(access.error)) {
      localStorage.removeItem("promotores-saas-auth-user");
      window.location.replace("/login");
      return <LoadingScreen />;
    }
    // Offline sem cache: mostra aviso mas não bloqueia completamente
    if (!isOnline()) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100">
          <section className="max-w-lg rounded-2xl border border-amber-400/30 bg-slate-900 p-6 text-center">
            <h1 className="text-xl font-bold">Sem conexão</h1>
            <p className="mt-2 text-sm text-slate-300">Os dados não estão disponíveis offline. Conecte-se para carregar este módulo.</p>
          </section>
        </main>
      );
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
            <p className="mt-4 text-xs text-slate-400">Peça ao administrador da plataforma para liberar este módulo.</p>
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
      {/* Rotas públicas do GondUp */}
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
      <Route path="/clean">
        {() => {
          try {
            // Limpa tudo: auth, offline queue, offline cache
            const keys = Object.keys(localStorage);
            keys.forEach((k) => {
              if (k.startsWith("gondup:") || k.startsWith("promotores-saas-")) localStorage.removeItem(k);
            });
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => undefined);
            }
            if ("caches" in window) {
              caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => undefined);
            }
          } catch (e) { /* ignore */ }
          setTimeout(() => { window.location.href = "/login"; }, 600);
          return <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white"><p>Limpando todos os dados locais... redirecionando</p></main>;
        }}
      </Route>
      <Route path="/login" component={LoginPage} />
      {/* cadastro público arquivado */}
      <Route path="/produtos"><CommercialProtected><ProductsPage /></CommercialProtected></Route>
      <Route path="/lojas/:storeId"><CommercialProtected><FeatureProtected featureKey="fieldOperations"><StoreGalleryPage /></FeatureProtected></CommercialProtected></Route>
      <Route path="/lojas"><CommercialProtected><FeatureProtected featureKey="fieldOperations"><StoresPage /></FeatureProtected></CommercialProtected></Route>
      <Route path="/lixeira"><CommercialProtected><TrashPage /></CommercialProtected></Route>
      <Route path="/ponto"><PromoterProtected><FeatureProtected featureKey="timeTracking"><PromoterClockPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/espelho-ponto"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetMirrorPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/check-in-out"><CompanyAdminProtected><FeatureProtected featureKey="fieldOperations"><CheckInOutPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/cartao-ponto"><AdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetPage /></FeatureProtected></AdminProtected></Route>
      {/* Raiz: visitante → landing; autenticado → painel conforme o perfil */}
      <Route path="/"><RootRoute /></Route>
      <Route path="/admin/empresas"><PlatformProtected><PlatformCompaniesPage /></PlatformProtected></Route>
      <Route path="/admin/auditoria"><PlatformProtected><PlatformAuditPage /></PlatformProtected></Route>
      <Route path="/plataforma/ponto"><PlatformProtected><PlatformDashboard section="time" /></PlatformProtected></Route>
      <Route path="/plataforma/scanner"><PlatformProtected><PlatformDashboard section="code-scanner" /></PlatformProtected></Route>
      <Route path="/plataforma/ia"><PlatformProtected><PlatformDashboard section="ai-support" /></PlatformProtected></Route>
      <Route path="/admin/usuarios"><AdminProtected><FeatureProtected featureKey="teamManagement"><AdminUsersPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/meus-modulos"><CompanyAdminProtected><CompanyModulesPage /></CompanyAdminProtected></Route>
      <Route path="/minha-conta"><AdminProtected><MyAccountPage /></AdminProtected></Route>
      <Route path="/auditoria"><CompanyAdminProtected><FeatureProtected featureKey="reports"><AuditPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  usePhotoSync();
  useStoreSync();
  useClientSync();
  useVisitSync();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <BusyProvider>
            <Toaster />
            <PwaStatusBar />
            <Suspense fallback={<LoadingScreen />}>
              <Router />
            </Suspense>
          </BusyProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
