import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PwaStatusBar } from "./components/PwaStatusBar";
import { PwaInstallOverlay } from "./components/PwaInstallOverlay";
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
const MyDataPage = lazy(() => import("./pages/promoter/MyDataPage"));
const LgpdPage = lazy(() => import("./pages/admin/LgpdPage"));
const PontoLegalPage = lazy(() => import("./pages/admin/PontoLegalPage"));
const PlatformPontoLegalPage = lazy(() => import("./pages/platform/PlatformPontoLegalPage"));
const TimesheetMirrorPage = lazy(() => import("./pages/admin/TimesheetMirrorPage"));
const TeamTimeBankPage = lazy(() => import("./pages/admin/TeamTimeBankPage"));
const TimesheetArchivePage = lazy(() => import("./pages/admin/TimesheetArchivePage"));
const CheckInOutPage = lazy(() => import("./pages/admin/CheckInOutPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const PlatformCompaniesPage = lazy(() => import("./pages/platform/PlatformCompaniesPage"));
const PlatformAuditPage = lazy(() => import("./pages/platform/PlatformAuditPage"));
const PlatformUsersPage = lazy(() => import("./pages/platform/PlatformUsersPage"));
const PlatformCheckInOutTestPage = lazy(() => import("./pages/platform/PlatformCheckInOutTestPage"));
const PaymentRequiredPage = lazy(() => import("./pages/PaymentRequiredPage"));

/**
 * Abertura mais rápida: já começa a baixar a tela da rota atual enquanto o login/assinatura/módulos são
 * confirmados (antes a tela só começava a carregar depois dessas 2–3 consultas, uma atrás da outra).
 * Mesmos import() das telas acima: o navegador reaproveita o mesmo arquivo, nada é baixado duas vezes.
 */
const ROUTE_PRELOADS: Array<[RegExp, () => Promise<unknown>]> = [
  [/^\/produtos/, () => import("./pages/ProductsPage")],
  [/^\/lojas\/./, () => import("./pages/StoreGalleryPage")],
  [/^\/lojas/, () => import("./pages/StoresPage")],
  [/^\/lixeira/, () => import("./pages/TrashPage")],
  [/^\/ponto-legal/, () => import("./pages/admin/PontoLegalPage")],
  [/^\/ponto/, () => import("./pages/promoter/PromoterClockPage")],
  [/^\/espelho-ponto/, () => import("./pages/admin/TimesheetMirrorPage")],
  [/^\/banco-de-horas/, () => import("./pages/admin/TeamTimeBankPage")],
  [/^\/arquivos-historicos/, () => import("./pages/admin/TimesheetArchivePage")],
  [/^\/check-in-out/, () => import("./pages/admin/CheckInOutPage")],
  [/^\/cartao-ponto/, () => import("./pages/admin/TimesheetPage")],
  [/^\/ferias/, () => import("./pages/admin/VacationsPage")],
  [/^\/meus-comprovantes/, () => import("./pages/promoter/MyReceiptsPage")],
  [/^\/meu-espelho/, () => import("./pages/promoter/MyMirrorPage")],
  [/^\/meus-dados/, () => import("./pages/promoter/MyDataPage")],
  [/^\/lgpd/, () => import("./pages/admin/LgpdPage")],
  [/^\/minhas-ferias/, () => import("./pages/promoter/MyVacationsPage")],
  [/^\/admin\/usuarios/, () => import("./pages/AdminUsersPage")],
  [/^\/meus-modulos/, () => import("./pages/CompanyModulesPage")],
  [/^\/minha-conta/, () => import("./pages/MyAccountPage")],
  [/^\/auditoria/, () => import("./pages/AuditPage")],
];
function preloadCurrentRoute() {
  if (typeof window === "undefined") return;
  try {
    const path = window.location.pathname;
    let loader = ROUTE_PRELOADS.find(([re]) => re.test(path))?.[1];
    if (!loader && path === "/") {
      // Tela inicial depende do perfil salvo no aparelho (sem perfil: página pública, que já carrega sozinha).
      const role = JSON.parse(localStorage.getItem("promotores-saas-auth-user") || "null")?.role;
      if (role === "promoter" || role === "user" || role === "operator" || role === "technician") loader = () => import("./pages/promoter/PromoterDashboard");
      else if (role === "company_admin" || role === "admin" || role === "supervisor") loader = () => import("./pages/operations/OperationsDashboard");
    }
    void loader?.().catch(() => undefined);
  } catch { /* só otimização */ }
}
preloadCurrentRoute();
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cacheGet, cacheSet, isOnline } from "@/lib/offlineCache";
import { useOutboxSync } from "@/hooks/useOutbox";
import { useStoreSync } from "@/hooks/useStoreSync";
import { useClientSync } from "@/hooks/useClientSync";
import type { EntitlementKey } from "@shared/entitlements";
import { useEffect } from "react";
import { installSpaNavigation } from "@/lib/spaNavigation";


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

/** Administrador geral vê os usuários de todas as empresas; a empresa vê a própria equipe. */
function UsersRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user?.role === "platform_admin") return <PlatformUsersPage />;
  return <AdminProtected><FeatureProtected featureKey="teamManagement"><AdminUsersPage /></FeatureProtected></AdminProtected>;
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

  // Offline a consulta fica "pausada" (isLoading eterno): segue com a cópia salva no aparelho (ou mostra "Sem conexão"), em vez de girar para sempre.
  if (access.isLoading && isOnline()) return <LoadingScreen />;

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
      <Route path="/banco-de-horas/:memberId"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><TeamTimeBankPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/banco-de-horas"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><TeamTimeBankPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/arquivos-historicos"><CompanyAdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetArchivePage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/check-in-out"><CompanyAdminProtected><FeatureProtected featureKey="visitCheckIn"><CheckInOutPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/cartao-ponto"><AdminProtected><FeatureProtected featureKey="timeTracking"><TimesheetPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/ferias"><AdminProtected><FeatureProtected featureKey="timeTracking"><VacationsPage /></FeatureProtected></AdminProtected></Route>
      <Route path="/meus-comprovantes"><PromoterProtected><FeatureProtected featureKey="timeTracking"><MyReceiptsPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/meu-espelho"><PromoterProtected><FeatureProtected featureKey="timeTracking"><MyMirrorPage /></FeatureProtected></PromoterProtected></Route>
      <Route path="/meus-dados"><PromoterProtected><MyDataPage /></PromoterProtected></Route>
      <Route path="/lgpd"><CompanyAdminProtected><LgpdPage /></CompanyAdminProtected></Route>
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
      <Route path="/admin/usuarios"><UsersRoute /></Route>
      <Route path="/meus-modulos"><CompanyAdminProtected><CompanyModulesPage /></CompanyAdminProtected></Route>
      <Route path="/minha-conta"><AdminProtected><MyAccountPage /></AdminProtected></Route>
      <Route path="/auditoria"><CompanyAdminProtected><FeatureProtected featureKey="reports"><AuditPage /></FeatureProtected></CompanyAdminProtected></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </ErrorBoundary>
  );
}

/**
 * Pede junto com o login (no mesmo lote) as consultas que as telas protegidas esperam antes de abrir:
 * assinatura (SubscriptionGate) e módulos liberados (FeatureProtected). Mesmas chaves e condições dessas telas,
 * então elas só reaproveitam o resultado. Antes eram 3 idas ao servidor em fila antes da tela começar a carregar.
 */
function WarmStart() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  trpc.billing.access.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin" && user.companyId),
    staleTime: 30_000,
    retry: false,
  });
  trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    retry: false,
  });
  useEffect(() => installSpaNavigation(navigate), [navigate]);
  return null;
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
            <PwaInstallOverlay />
            <SwUpdatePrompt />
            <WarmStart />
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
