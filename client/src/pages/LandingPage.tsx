import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, MapPinned, Shield, Users, Zap, Clock, Camera, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo, BRAND_TAGLINE } from "@/components/BrandLogo";

const features = [
  { icon: Users, title: "Equipes organizadas", text: "Promotores, supervisores e administradores em uma operação multiempresa, com permissões claras." },
  { icon: MapPinned, title: "Roteiros inteligentes", text: "Programe visitas por dia da semana, distribua lojas e acompanhe a execução em tempo real." },
  { icon: CalendarCheck, title: "Ponto eletrônico", text: "Entrada, intervalo e saída com localização, histórico auditável e alerta de batida faltante." },
  { icon: Camera, title: "Fotos com evidência", text: "Registre a execução no ponto de venda com marca d'água, GPS e compartilhamento seguro." },
  { icon: ClipboardList, title: "Controle de produtos", text: "Acompanhe validade, estoque e alertas de produtos próximos do vencimento." },
  { icon: BarChart3, title: "Painel gerencial", text: "Indicadores de jornada, fotos e validade em uma visão clara para a gestão." },
];

const benefits = [
  "Saída automática configurável por empresa e por promotor",
  "Galeria de fotos com filtro por loja e compartilhamento",
  "Cartão-ponto com aprovação de correções",
  "Lixeira com restauração por 5 dias",
  "Multiempresa com isolamento de dados",
  "Aplicativo PWA instalável no celular",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050a0f] text-white">
      {/* Hero */}
      <section className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,.18),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(34,197,94,.12),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8">
          <nav className="flex items-center justify-between">
            <BrandLogo height={52} />
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="text-slate-300 hover:text-white" onClick={() => window.location.href = "/login"}>Entrar</Button>
              <Button className="bg-emerald-500 text-white hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>Começar agora</Button>
            </div>
          </nav>

          <div className="grid gap-12 pb-20 pt-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-sm font-semibold text-emerald-300">
                <Zap className="h-4 w-4" /> Plataforma de gestão de promotores
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Da gôndola ao trade.<br />
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Seu próximo upgrade.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                A GONDUP conecta agências, supervisores e promotores para transformar roteiros em execução mensurável, com ponto, fotos e evidências em um só lugar.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button className="h-12 bg-emerald-500 px-6 text-base font-bold text-white hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>
                  Criar ambiente <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-12 border-white/20 bg-white/5 px-6 text-white hover:bg-white/10" onClick={() => document.getElementById("recursos")?.scrollIntoView({ behavior: "smooth" })}>
                  Conhecer recursos
                </Button>
              </div>
              <p className="mt-5 text-sm text-slate-500">{BRAND_TAGLINE}</p>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Operação de hoje</p>
                    <p className="mt-1 text-2xl font-black">Campo em movimento</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-300">128</p>
                    <p className="text-xs text-slate-400">Visitas</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-300">24</p>
                    <p className="text-xs text-slate-400">Promotores</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-300">96%</p>
                    <p className="text-xs text-slate-400">Execução</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                  <Clock className="h-5 w-5 text-emerald-300" />
                  <p className="text-sm text-slate-200">3 jornadas abertas · 2 batidas faltantes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Recursos</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tudo que sua operação de campo precisa</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">Do ponto à evidência fotográfica, a GONDUP organiza a rotina do promotor e dá visibilidade ao gestor.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="group rounded-2xl border border-white/10 bg-white/[.03] p-6 transition hover:border-emerald-400/30 hover:bg-white/[.05]">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300 group-hover:bg-emerald-400/20">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-white/10 bg-white/[.02]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Feito para agências e indústrias</h2>
              <p className="mt-4 text-slate-400">Controle multiempresa, permissões por função e auditoria em cada ação. Sem planilhas, sem perda de informação.</p>
            </div>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <span className="text-slate-200">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
        <Shield className="mx-auto h-10 w-10 text-emerald-400" />
        <h2 className="mt-4 text-3xl font-black">Pronto para o próximo upgrade?</h2>
        <p className="mt-3 text-slate-400">Comece a organizar sua operação de campo hoje.</p>
        <Button className="mt-6 h-12 bg-emerald-500 px-8 text-base font-bold text-white hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>
          Criar meu ambiente <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">
        GONDUP · Da gôndola ao trade. Seu próximo upgrade.
      </footer>
    </main>
  );
}
