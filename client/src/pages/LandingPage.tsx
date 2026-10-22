import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, MapPinned, Shield, Users, Zap, Clock, Camera, BarChart3, Smartphone, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Users, title: "Gestão de equipes", text: "Cadastre promotores, defina horários e acompanhe quem está em campo agora." },
  { icon: MapPinned, title: "Roteiros semanais", text: "Monte a programação por dia da semana e distribua lojas automaticamente." },
  { icon: CalendarCheck, title: "Ponto eletrônico", text: "Entrada, intervalo e saída com GPS, histórico e alerta de batida faltante." },
  { icon: Camera, title: "Fotos com evidência", text: "Registre a execução com marca d'água, localização e compartilhamento." },
  { icon: ClipboardList, title: "Produtos e validade", text: "Controle estoque, validade e receba alertas de produtos próximos do vencimento." },
  { icon: BarChart3, title: "Painel gerencial", text: "Indicadores de jornada, fotos e execução em uma visão clara." },
];

const steps = [
  { n: "01", title: "Cadastre sua empresa", text: "Crie o ambiente, defina administradores e importe promotores." },
  { n: "02", title: "Configure roteiros", text: "Monte a programação semanal e distribua as lojas." },
  { n: "03", title: "Acompanhe em campo", text: "Ponto, fotos e evidências chegam em tempo real." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <img src="/gondup-logo.png" alt="GONDUP" className="h-14 w-auto" />
          <div className="flex items-center gap-3">
            <button className="text-sm text-slate-300 hover:text-white" onClick={() => window.location.href = "/login"}>Entrar</button>
            <Button className="bg-emerald-500 text-white hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>Começar</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-5 pt-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,.15),transparent_60%)]" />
        <div className="relative">
          <img src="/gondup-logo.png" alt="GONDUP" className="mx-auto h-32 w-auto sm:h-40 lg:h-48" />
          <p className="mt-4 text-xl font-semibold text-white sm:text-2xl">Da gôndola ao trade. <span className="text-emerald-400">Seu próximo upgrade.</span></p>
          <h1 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            A plataforma que organiza sua <span className="text-emerald-400">operação de campo</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Ponto eletrônico, roteiros, fotos com evidência e painel gerencial. Tudo que agências e indústrias precisam para controlar promotores de merchandising.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button className="h-14 bg-emerald-500 px-8 text-base font-bold text-white hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>
              Criar ambiente gratuito <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" className="h-14 border-white/20 bg-white/5 px-8 text-base text-white hover:bg-white/10" onClick={() => document.getElementById("como")?.scrollIntoView({ behavior: "smooth" })}>
              Como funciona
            </Button>
          </div>
        </div>
      </section>

      {/* Destaques */}
      <section className="border-y border-white/10 bg-white/[.02]">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:grid-cols-3 sm:px-8">
          {[
            { icon: "📍", title: "Localização em tudo", text: "Ponto e fotos com GPS. Saiba onde cada promotor está e onde cada evidência foi registrada." },
            { icon: "📸", title: "Evidência fotográfica", text: "Fotos com marca d'água, data e local. Compartilhe no WhatsApp ou gere relatório." },
            { icon: "⚡", title: "Tempo real", text: "Acompanhe quem está em campo, quem bateu ponto e quem tem batida faltante agora." },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center">
              <p className="text-4xl">{s.icon}</p>
              <p className="mt-4 text-lg font-bold">{s.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Recursos</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Feito para a rotina real do campo</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[.03] p-6 transition hover:border-emerald-500/40 hover:bg-white/[.05]">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como" className="border-y border-white/10 bg-white/[.02]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Como funciona</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Três passos para começar</h2>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <p className="text-4xl font-black text-emerald-500/40">{s.n}</p>
                <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-black">Controle sem planilha</h2>
            <p className="mt-4 text-slate-400">Multiempresa, permissões por função e auditoria em cada ação. A GONDUP substitui planilhas, grupos de WhatsApp e controle manual.</p>
            <ul className="mt-6 space-y-3">
              {["Saída automática configurável", "Cartão-ponto com correções", "Galeria de fotos por loja", "Alertas de validade", "PWA instalável no celular", "Isolamento de dados por empresa"].map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <Smartphone className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="font-bold">Aplicativo no celular</p>
                <p className="text-sm text-slate-400">Instale como PWA e use offline.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <Lock className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="font-bold">Seguro e auditável</p>
                <p className="text-sm text-slate-400">Cada ação fica registrada.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <FileText className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="font-bold">Relatórios prontos</p>
                <p className="text-sm text-slate-400">Espelho de ponto e evidências.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 bg-gradient-to-b from-emerald-950/30 to-black">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <img src="/gondup-logo.png" alt="GONDUP" className="mx-auto h-20 w-auto" />
          <h2 className="mt-6 text-3xl font-black">Pronto para o upgrade?</h2>
          <p className="mt-3 text-slate-400">Comece a organizar sua operação de campo hoje.</p>
          <Button className="mt-8 h-14 bg-emerald-500 px-10 text-base font-bold text-white hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>
            Criar meu ambiente <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">
        GONDUP · Da gôndola ao trade. Seu próximo upgrade.
      </footer>
    </main>
  );
}
