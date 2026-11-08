import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { SwUpdatePrompt } from "./components/SwUpdatePrompt";
import { BusyProvider } from "./components/BusyOverlay";
import { GlobalMutationIndicator } from "./components/GlobalMutationIndicator";

// Code-splitting: cada página vira um chunk carregado sob demanda.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
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
const VacationsPage = lazy(() => import("./pages/admin/VacationsPage"));
const MyVacationsPage = lazy(() => import("./pages/promoter/MyVacationsPage"));
const MyReceiptsPage = lazy(() => import("./pages/promoter/MyReceiptsPage"));
const MyMirrorPage = lazy(() => import("./pages/promoter/MyMirrorPage"));
const PontoLegalPage = lazy(() => import("./pages/admin/PontoLegalPage"));
const PlatformPontoLegalPage = lazy(() => import("./pages/platform/PlatformPontoLegalPage"));
const TimesheetMirrorPage = lazy(() => import("./pages/admin/TimesheetMirrorPage"));
const TimesheetArchivePage = lazy(() => import("./pages/admin/TimesheetArchivePage"));
const CheckInOutPage = lazy(() => import("./pages/admin/CheckInOutPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const PlatformCompaniesPage = lazy(() => import("./pages/platform/PlatformCompaniesPage"));
const PlatformAuditPage = lazy(() => import("./pages/platform/PlatformAuditPage"));
const PlatformCheckInOutTestPage = lazy(() => import("./pages/platform/PlatformCheckInOutTestPage"));
const PaymentRequiredPage = lazy(() => import("./pages/PaymentRequiredPage"));
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cacheGet, cacheSet, isOnline } from "@/lib/offlineCache";
import { useOutboxSync } from "@/hooks/useOutbox";
import { useStoreSync } from "@/hooks/useStoreSync";
import { useClientSync } from "@/hooks/useClientSync";
import type { EntitlementKey } from "@shared/entitlements";
import { useEffect } from "react";


/** Se a assinatura passou da tolerância, só mostra a tela de pagamento (exceto admin da plataforma). */
function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const access = trpc.billing.access.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin" && user.companyId),
    staleTime: 30_000,
    retry: false,
  });
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "platform_admin" || !user.companyId) return <>{children}</>;
  if (access.isLoading) return <LoadingScreen />;
  if (access.data && access.data.allowed === false) {
    return <PaymentRequiredPage />;
  }
  return <>{children}</>;
}

function RedirectHome() { if (typeof window !== "undefined") window.location.replace("/"); return <LoadingScreen />; }

function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-7 w-7 animate-spin text-teal-300" /></div>; }

function CommercialProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role === "platform_admin" || !user.companyId) return <RedirectHome />;
  return <SubscriptionGate>{children}</SubscriptionGate>;
}

function PlatformProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "platform_admin") return <RedirectHome />;
  return <>{children}</>;
}

function PlatformTestProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "platform_admin") return <RedirectHome />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <RedirectHome />;
  if (user.role === "platform_admin") return <>{children}</>;
  return <SubscriptionGate>{children}</SubscriptionGate>;
}

function CompanyAdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "company_admin") return <RedirectHome />;
  return <SubscriptionGate>{children}</SubscriptionGate>;
}

function PromoterProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "promoter") return <RedirectHome />;
  return <SubscriptionGate>{children}</SubscriptionGate>;
}

function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  const anyErr = error as any;
  const msg = String(anyErr.message || anyErr.shape?.message || anyErr.data?.message || "").toLowerCase();
  const code = anyErr.data?.code || anyErr.shape?.data?.code;
  if (code === "UNAUTHORIZED") return true;
  if (msg.includes("please login") || msg.includes("10001")) return true;
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
  const cachedEntitlements = cacheGet<any>("entitlements");
  if (accessQuery.data) cacheSet("entitlements", accessQuery.data);
  const access = {
    ...accessQuery,
    data: accessQuery.data ?? (!isOnline() || accessQuery.isError ? cachedEntitlements : undefined),
  };

  useEffect(() => {
    if (access.error && isUnauthorizedError(access.error)) {
      localStorage.removeItem("promotores-saas-auth-user");
      window.location.replace("/login");
    }
  }, [access.error]);

  if (loading) return <LoadingScreen />;
  if (!user) return <RedirectHome />;
  if (user.role === "platform_admin") return <>{children}</>;

  if ((featureKey === "dashboard" || featureKey === "fieldOperations") && user) {
    if (access.isLoading && isOnline()) return <LoadingScreen />;
    if (access.error && isUnauthorizedError(access.error)) return <LoadingScreen />;
    return <>{children}</>;
  }

  if (access.isLoading) return <LoadingScreen />;

  if (access.error && isUnauthorizedError(access.error)) {
    localStorage.removeItem("promotores-saas-auth-user");
    window.location.replace("/login");
    return <LoadingScreen />;
  }

  if (!access.data?.effective?.[featureKey]) {
    if (featureKey === "timeTracking" && access.data) return <RedirectHome />;
    if (!isOnline() && cachedEntitlements?.effective) {
      return <>{children}</>;
    }
    const errMsg = String((access.error as any)?.message || (access.error as any)?.shape?.message || "").toLowerCase();
    if (errMsg.includes("please login") || errMsg.includes("10001") || isUnauthorizedError(access.error)) {
      localStorage.removeItem("promotores-saas-auth-user");
      window.location.replace("/login");
      return <LoadingScreen />;
    }
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
  if (user.role === "promoter") return <SubscriptionGate><PromoterDashboard /></SubscriptionGate>;
  if (user.companyId) return <SubscriptionGate><OperationsDashboard /></SubscriptionGate>;
  return <LandingPage />;
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
    <Switch>
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
      <Route path="/esqueci-senha" component={ForgotPasswordPage} />
      <Route path="/redefinir-senha" component={ResetPasswordPage} />
      <Route path="/termos">{() => <LegalPage kind="termos" />}</Route>
      <Route path="/privacidade">{() => <LegalPage kind="privacidade" />}</Route>
      <Route path="/produtos"><CommercialProtected><FeatureProtected featureKey="products"><ProductsPage /></FeatureProtected></CommercialProtected></Route>
      <Route path="/lojas/:storeId"><CommercialProtected><FeatureProtected featureKey="fieldOperations"><StoreGalleryPage /></FeatureProtected></CommercialProtected></Route>
      <Route path="/lojas"><CommercialProtected><FeatureProtected featureKey="fieldOperations"><StoresPage /></FeatureProtected></CommercialProtected></Route>
      <Route path="/lixeira"><CommercialProtected><TrashPage /></CommercialProtected></Route>
      <Route path="/ponto"><PromoterProtected><FeatureProtected featureKey="timeTracking"><PromoterClockPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/espelho-ponto"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetMirrorPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/arquivos-historicos"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetArchivePage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/check-in-out"><CompanyAdminProtected><FeatureProtected featureKey="visitCheckIn"><CheckInOutPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/cartao-ponto"><AdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/ferias"><AdminProtected><FeatureProtected featureKey="timeTracking"><VacationsPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/meus-comprovantes"><PromoterProtected><FeatureProtected featureKey="timeTracking"><MyReceiptsPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/meu-espelho"><PromoterProtected><FeatureProtected featureKey="timeTracking"><MyMirrorPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/ponto-legal"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><PontoLegalPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/minhas-ferias"><PromoterProtected><FeatureProtected featureKey="timeTracking"><MyVacationsPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/"><RootRoute /></Route>
      <Route path="/admin/empresas"><PlatformProtected><PlatformCompaniesPage /></PlatformProtected></Route>
      <Route path="/admin/auditoria"><PlatformProtected><PlatformAuditPage /></PlatformProtected></Route>
      <Route path="/plataforma/teste-check-in-out"><PlatformTestProtected><PlatformCheckInOutTestPage /></PlatformTestProtected></Route>
      <Route path="/plataforma/ponto"><PlatformProtected><PlatformDashboard section="time" /></PlatformProtected></Route>
      <Route path="/plataforma/ponto-legal"><PlatformProtected><PlatformPontoLegalPage /></PlatformProtected></Route>
      <Route path="/plataforma/scanner"><PlatformProtected><PlatformDashboard section="code-scanner" /></PlatformProtected></Route>
      <Route path="/plataforma/ia"><PlatformProtected><PlatformDashboard section="ai-support" /></PlatformProtected></Route>
      <Route path="/admin/usuarios"><AdminProtected><FeatureProtected featureKey="teamManagement"><AdminUsersPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/meus-modulos"><CompanyAdminProtected><CompanyModulesPage /></CompanyAdminProtected></Route>
      <Route path="/minha-conta"><AdminProtected><MyAccountPage /></AdminProtected></Route>
      <Route path="/auditoria"><CompanyAdminProtected><FeatureProtected featureKey="reports"><AuditPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </ErrorBoundary>
  );
}

function App() {
  useOutboxSync();
  useStoreSync();
  useClientSync();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <BusyProvider>
            <Toaster />
            <ConfirmHost />
            <GlobalMutationIndicator />
            <PwaStatusBar />
            <SwUpdatePrompt />
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
