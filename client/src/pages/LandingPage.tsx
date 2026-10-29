import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Fingerprint,
  MapPinned,
  Radio,
  Route,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  WifiOff,
} from "lucide-react";
import { useLocation } from "wouter";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#recursos", label: "Recursos" },
  { href: "#operacao", label: "Operação" },
  { href: "#perfis", label: "Perfis" },
  { href: "/login", label: "Entrar" },
];

const metrics = [
  { value: "GPS", label: "Ponto com localização" },
  { value: "PWA", label: "Campo mesmo offline" },
  { value: "3", label: "Perfis por empresa" },
  { value: "24/7", label: "Auditoria da jornada" },
];

const features = [
  {
    icon: Clock3,
    title: "Ponto eletrônico com GPS",
    text: "Entrada, intervalo e saída com sequência validada, geolocalização e chave de idempotência para evitar marcações duplicadas.",
  },
  {
    icon: Route,
    title: "Roteiros e visitas",
    text: "Monte o dia de cada promotor, acompanhe o status da visita e registre início e fim com precisão de campo.",
  },
  {
    icon: Store,
    title: "Lojas e pontos de venda",
    text: "Cadastre redes, lojas e clientes com endereço, coordenadas e histórico de evidências por ponto.",
  },
  {
    icon: Camera,
    title: "Fotos e evidências",
    text: "Capture merchandising na gôndola com data, local e retenção controlada para a gestão revisar o que aconteceu na loja.",
  },
  {
    icon: ClipboardCheck,
    title: "Checklists padronizados",
    text: "Execute formulários por visita, marca ou cliente e transforme a rotina de campo em um padrão auditável.",
  },
  {
    icon: Users,
    title: "Equipes e permissões",
    text: "Administre administradores, supervisores e promotores com módulos liberados por plano, empresa e usuário.",
  },
  {
    icon: ShieldCheck,
    title: "Auditoria e espelho de ponto",
    text: "Trilha append-only, cartão de ponto e espelho da jornada para conferência gerencial sem perder o isolamento por empresa.",
  },
  {
    icon: WifiOff,
    title: "Operação mobile e offline",
    text: "PWA pensado para o chão de loja: o promotor registra o essencial mesmo com sinal instável e sincroniza depois.",
  },
];

const roles = [
  {
    title: "Promotor",
    text: "Marca o ponto, segue o roteiro do dia, registra visitas e envia evidências direto do celular.",
    items: ["Jornada com GPS", "Roteiro do dia", "Fotos da loja"],
  },
  {
    title: "Supervisor",
    text: "Acompanha a equipe em campo, confere execução e age rápido quando a visita sai do plano.",
    items: ["Visão da operação", "Lojas e rotas", "Status em tempo real"],
  },
  {
    title: "Administrador",
    text: "Controla usuários, módulos liberados e a trilha de auditoria da empresa em um único painel.",
    items: ["Permissões por módulo", "Espelho de ponto", "Assinatura e equipe"],
  },
];

const steps = [
  {
    step: "01",
    title: "Estruture a operação",
    text: "Cadastre empresa, lojas, clientes e a equipe com papéis claros desde o primeiro acesso.",
  },
  {
    step: "02",
    title: "Distribua o campo",
    text: "Monte roteiros, atribua visitas e deixe o promotor com o dia organizado no celular.",
  },
  {
    step: "03",
    title: "Meça a execução",
    text: "Ponto, evidências e auditoria mostram o que foi feito — e o que ainda precisa de correção.",
  },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b14] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-8rem] h-[32rem] w-[32rem] rounded-full bg-teal-500/15 blur-[140px]" />
        <div className="absolute right-[-8rem] top-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[80%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      </div>

      <header className="relative z-20 border-b border-white/8 bg-[#050b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <img
            src="/gondup-icon.png"
            alt="GONDUP"
            className="h-16 w-auto object-contain sm:h-[4.5rem]"
            draggable={false}
          />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-400 md:flex">
            {navLinks.map((link) =>
              link.href.startsWith("#") ? (
                <button key={link.href} className="transition hover:text-white" onClick={() => scrollTo(link.href.slice(1))}>
                  {link.label}
                </button>
              ) : (
                <button key={link.href} className="transition hover:text-white" onClick={() => navigate(link.href)}>
                  {link.label}
                </button>
              ),
            )}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-teal-400/50 bg-teal-400/10 text-teal-200 hover:bg-teal-400/20 hover:text-white" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button className="bg-teal-400 text-slate-950 hover:bg-teal-300" onClick={() => navigate("/login")}>
              Começar
            </Button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-24 lg:pt-20">
        <div>
          <img
            src="/gondup-lockup.png"
            alt="GONDUP — Da gôndola ao trade. Seu próximo upgrade."
            className="h-auto w-full max-w-[34rem] object-contain object-left"
            draggable={false}
          />
          <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
            <Radio className="h-3.5 w-3.5" />
            Plataforma de trade marketing
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
            Controle total da equipe em campo, da gôndola ao ponto.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            GONDUP reúne jornada, roteiros, lojas e evidências em um único ambiente multiempresa. Supervisione a execução no PDV com a mesma clareza da operação no escritório.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="bg-teal-400 px-6 text-slate-950 hover:bg-teal-300" onClick={() => navigate("/login")}>
              Criar ambiente
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/15 bg-white/5 px-6 text-white hover:bg-white/10"
              onClick={() => scrollTo("recursos")}
            >
              Ver funcionalidades
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.2rem] bg-teal-400/10 blur-2xl" />
          <article className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/80 shadow-2xl shadow-teal-950/40 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Operação ao vivo</p>
                <p className="mt-1 text-lg font-bold text-white">Painel de campo</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Sincronizado
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Visitas do dia</p>
                <p className="mt-2 text-3xl font-black text-white">42</p>
                <p className="mt-1 text-xs text-teal-300">31 concluídas</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Promotores ativos</p>
                <p className="mt-2 text-3xl font-black text-white">18</p>
                <p className="mt-1 text-xs text-cyan-300">12 em loja agora</p>
              </div>
            </div>
            <div className="space-y-2 px-5 pb-5">
              {[
                { name: "Mercado Central", status: "Em visita", detail: "Checklist 4/6" },
                { name: "Rede Norte — Loja 12", status: "Ponto aberto", detail: "GPS 18 m" },
                { name: "Atacado Sul", status: "Evidência enviada", detail: "há 4 min" },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{row.name}</p>
                    <p className="text-xs text-slate-400">{row.detail}</p>
                  </div>
                  <span className="text-xs font-medium text-teal-200">{row.status}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/8 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 sm:px-8 md:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.label}>
              <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">{item.value}</p>
              <p className="mt-1 text-sm text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="recursos" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">Recursos</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
          Tudo o que a operação de merchandising precisa, no mesmo sistema.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
          Do cadastro da loja à conferência do ponto, cada módulo foi pensado para agências que precisam de presença, prova e controle.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-teal-300/30 hover:bg-white/[0.055]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-400/10 text-teal-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="operacao" className="relative z-10 mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <div className="grid gap-10 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">Como funciona</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Da escala à evidência, sem perder o controle.</h2>
            <div className="mt-8 space-y-6">
              {steps.map((item) => (
                <div key={item.step} className="flex gap-4">
                  <span className="mt-0.5 font-mono text-sm font-bold text-teal-300">{item.step}</span>
                  <div>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <MapPinned className="h-6 w-6 text-teal-300" />
              <p className="mt-4 font-semibold text-white">Geolocalização na marcação</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Cada evento de ponto registra coordenadas, precisão e status da localização.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Fingerprint className="h-6 w-6 text-teal-300" />
              <p className="mt-4 font-semibold text-white">Sequência protegida</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Não há saída sem entrada, nem intervalo invertido. A jornada segue uma máquina de estados.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:col-span-2">
              <Smartphone className="h-6 w-6 text-teal-300" />
              <p className="mt-4 font-semibold text-white">Feito para o celular do promotor</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Interface mobile-first para bater ponto, abrir a visita e enviar a foto da gôndola em poucos toques.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="perfis" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">Perfis</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">Cada papel vê o que precisa — e só o que pode.</h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {roles.map((role) => (
            <article key={role.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">
              <h3 className="text-2xl font-black text-white">{role.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{role.text}</p>
              <ul className="mt-6 space-y-2">
                {role.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-teal-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-teal-300/20 bg-[linear-gradient(135deg,rgba(45,212,191,0.16),rgba(5,11,20,0.9)_42%,rgba(8,47,73,0.55))] px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Coloque sua operação de campo no mesmo ritmo da gestão.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Crie o ambiente da agência, convide a equipe e comece a medir presença, jornada e evidências ainda hoje.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="bg-teal-400 px-6 text-slate-950 hover:bg-teal-300" onClick={() => navigate("/login")}>
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/15 bg-white/5 px-6 text-white hover:bg-white/10" onClick={() => navigate("/login")}>
              Criar conta
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <BrandLogo variant="dark" height={28} />
          <p>GONDUP · Gestão inteligente de equipes de campo</p>
          <div className="flex gap-5">
            <button className="hover:text-white" onClick={() => navigate("/login")}>Entrar</button>
            <button className="hover:text-white" onClick={() => navigate("/login")}>Entrar</button>
          </div>
        </div>
      </footer>
    </main>
  );
}
