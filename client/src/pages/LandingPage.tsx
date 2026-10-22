import { useState, type ReactNode } from "react";
import { ArrowRight, Barcode, Building2, Camera, ClipboardList, Clock, MapPin, Menu, Route, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const display = { fontFamily: '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif' } as const;
const body = { fontFamily: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif' } as const;

const features = [
  { icon: Route, title: "Roteiros e visitas", text: "Defina quais lojas cada promotor visita em cada dia da semana. A visita abre, é executada e fecha com horário e local." },
  { icon: Clock, title: "Ponto eletrônico e espelho", text: "Entrada, intervalos e saída com localização. Se uma batida faltar, o promotor e o administrador recebem o alerta." },
  { icon: Camera, title: "Fotos com GPS, por loja e cliente", text: "Cada foto sai com promotor, local, data e hora na imagem e fica guardada dentro do cliente da loja." },
  { icon: Barcode, title: "Produtos e validades", text: "Cadastre pelo código de barras e receba o aviso dos produtos que vencem nos próximos 30 dias." },
  { icon: Users, title: "Equipe e permissões", text: "Administrador, supervisor e promotor veem só o que cabe a cada um. Quem sai da equipe perde o acesso na hora." },
  { icon: Building2, title: "Cada empresa no seu espaço", text: "Dados separados por empresa, com plano, validade e pagamentos acompanhados pelo administrador da plataforma." },
];

const steps = [
  { title: "Cadastre lojas e clientes", text: "Cada loja guarda os clientes (marcas) que a sua equipe atende nela." },
  { title: "Monte o roteiro", text: "Distribua as lojas entre os promotores, por dia da semana." },
  { title: "O promotor executa no celular", text: "Bate o ponto, abre a visita e tira as fotos dentro do cliente certo." },
  { title: "Você acompanha e confere", text: "Fotos, jornada e validades reunidas para conferir e enviar ao cliente." },
];

const roles = [
  { who: "Administrador", text: "Cadastra lojas, clientes e equipe, confere o espelho de ponto e acompanha tudo em um só painel." },
  { who: "Supervisor", text: "Acompanha a execução dos roteiros e as evidências de quem está sob a sua responsabilidade." },
  { who: "Promotor", text: "Abre o app no celular, vê as lojas do dia, bate o ponto e registra as fotos, mesmo com sinal fraco." },
];

const nav = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "/planos", label: "Planos" },
];

const css = `
@keyframes gu-drop { 0% { opacity: 0; transform: translateY(-26px) rotate(var(--r, 0deg)); } 60% { opacity: 1; transform: translateY(4px) rotate(var(--r, 0deg)); } 100% { opacity: 1; transform: translateY(0) rotate(var(--r, 0deg)); } }
.gu-tag { opacity: 0; animation: gu-drop .7s cubic-bezier(.2,.8,.3,1) forwards; }
.gu-focus:focus-visible { outline: 3px solid #12e676; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .gu-tag { animation: none; opacity: 1; } html { scroll-behavior: auto; } }
`;

function Tag({ children, className = "", delay = 0, rotate = 0 }: { children: ReactNode; className?: string; delay?: number; rotate?: number }) {
  return (
    <div className={`gu-tag absolute rounded-md border-2 border-[#08140e] bg-[#ffe55c] px-3 py-2 text-[13px] font-bold leading-tight text-[#08140e] shadow-[3px_3px_0_#08140e] ${className}`} style={{ animationDelay: `${delay}ms`, ["--r" as string]: `${rotate}deg` }}>
      {children}
    </div>
  );
}

function PhoneScene() {
  return (
    <div className="relative mx-auto h-[560px] w-full max-w-[460px] sm:h-[600px]" aria-hidden="true">
      {/* trilho da gôndola */}
      <div className="absolute inset-x-0 bottom-[34px] h-[14px] rounded-sm bg-[#08140e]" />
      <div className="absolute inset-x-3 bottom-[48px] h-[3px] bg-[#08140e]/15" />
      <div className="absolute inset-x-0 bottom-0 h-[34px] bg-[repeating-linear-gradient(90deg,#08140e_0_3px,transparent_3px_22px)] opacity-10" />

      {/* celular */}
      <div className="absolute bottom-[48px] left-1/2 w-[270px] -translate-x-1/2 rounded-[2.4rem] border-[9px] border-[#08140e] bg-[#08140e] shadow-[0_30px_60px_-24px_rgba(8,20,14,.55)]">
        <div className="overflow-hidden rounded-[1.8rem] bg-white">
          <div className="bg-[#08140e] px-4 pb-4 pt-5 text-white">
            <p className="text-[11px] text-white/60">Visita em andamento</p>
            <p className="mt-0.5 text-[17px] font-extrabold leading-tight" style={display}>Supermercado Exemplo</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#8cff63]"><MapPin className="h-3 w-3" /> Local confirmado</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-xl border border-[#08140e]/10 bg-[#f5f7f2] p-3">
              <p className="text-[11px] text-[#08140e]/60">Cliente</p>
              <p className="text-sm font-bold text-[#08140e]">Marca Exemplo</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["from-[#86ff62] to-[#00b394]", "from-[#d9f99d] to-[#4ade80]", "from-[#a7f3d0] to-[#14b8a6]"].map((g) => (
                <div key={g} className={`aspect-square rounded-lg bg-gradient-to-br ${g}`} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#12e676] py-3 text-sm font-extrabold text-[#08140e]"><Camera className="h-4 w-4" /> Tirar foto</div>
            <div className="flex items-center justify-between border-t border-[#08140e]/10 pt-3 text-[12px] text-[#08140e]/70"><span>Entrada</span><b className="text-[#08140e]">08:02</b></div>
          </div>
        </div>
      </div>

      {/* etiquetas de gôndola */}
      <Tag className="left-0 top-[92px]" delay={500} rotate={-4}>Ponto batido<br /><span className="font-medium">com localização</span></Tag>
      <Tag className="right-0 top-[176px]" delay={760} rotate={3}>Fotos dentro<br /><span className="font-medium">de cada cliente</span></Tag>
      <Tag className="left-2 top-[330px]" delay={1020} rotate={2}>Validade em até<br /><span className="font-medium">30 dias: alerta</span></Tag>
    </div>
  );
}

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f5f7f2] text-[#08140e] antialiased" style={body}>
      <style>{css}</style>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08140e]/95 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/" className="gu-focus rounded" aria-label="GondUp, página inicial"><BrandLogo kind="wordmark" height={34} /></a>
          <nav className="hidden items-center gap-7 text-[15px] font-semibold md:flex" aria-label="Principal">
            {nav.map((n) => <a key={n.label} href={n.href} className="gu-focus rounded hover:text-[#12e676]">{n.label}</a>)}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <a href="/login" className="gu-focus rounded px-3 py-2 text-[15px] font-semibold hover:text-[#12e676]">Entrar</a>
            <a href="/cadastro" className="gu-focus inline-flex items-center gap-2 rounded-lg bg-[#12e676] px-4 py-2.5 text-[15px] font-extrabold text-[#08140e] transition hover:bg-[#8cff63]">Criar ambiente</a>
          </div>
          <button type="button" className="gu-focus rounded-lg p-2 md:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-white/10 bg-[#08140e] px-5 pb-5 pt-3 md:hidden">
            <div className="flex flex-col gap-1 text-base font-semibold">
              {nav.map((n) => <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-white/10">{n.label}</a>)}
              <a href="/login" className="rounded-lg px-3 py-3 hover:bg-white/10">Entrar</a>
              <a href="/cadastro" className="mt-2 rounded-lg bg-[#12e676] px-4 py-3 text-center font-extrabold text-[#08140e]">Criar ambiente</a>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-6 lg:pb-24 lg:pt-20">
          <div>
            <h1 className="max-w-[16ch] text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.4rem]" style={display}>Sua equipe de campo, da gôndola ao relatório.</h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-8 text-[#08140e]/75">A GondUp reúne roteiros, ponto eletrônico, fotos com GPS e controle de validade em um só lugar, para agências e equipes de promotores que trabalham em lojas.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/cadastro" className="gu-focus inline-flex items-center gap-2 rounded-xl bg-[#12e676] px-6 py-3.5 text-base font-extrabold text-[#08140e] shadow-[4px_4px_0_#08140e] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#08140e]">Criar ambiente <ArrowRight className="h-4 w-4" /></a>
              <a href="/planos" className="gu-focus inline-flex items-center rounded-xl border-2 border-[#08140e] px-6 py-3.5 text-base font-bold transition hover:bg-[#08140e] hover:text-white">Ver planos</a>
            </div>
            <p className="mt-5 text-sm text-[#08140e]/60">Funciona no celular e pode ser instalada como aplicativo.</p>
          </div>
          <PhoneScene />
        </section>

        <section id="recursos" className="scroll-mt-20 border-y border-[#08140e]/10 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-[22ch] text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl" style={display}>Tudo o que a rotina de loja pede, sem planilha.</h2>
            <div className="mt-12 grid gap-x-12 gap-y-0 md:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="flex gap-5 border-t border-[#08140e]/12 py-7">
                  <span className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#12e676] text-[#08140e]"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight" style={display}>{title}</h3>
                    <p className="mt-2 max-w-[48ch] leading-7 text-[#08140e]/70">{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 bg-[#08140e] text-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-[20ch] text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl" style={display}>Do cadastro da loja à foto conferida.</h2>
            <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
              {steps.map((s, i) => (
                <li key={s.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#12e676] text-lg font-extrabold text-[#08140e]" style={display}>{i + 1}</span>
                    {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-gradient-to-r from-[#12e676] to-transparent md:block" aria-hidden="true" />}
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold tracking-tight" style={display}>{s.title}</h3>
                  <p className="mt-2 leading-7 text-white/70">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="max-w-[22ch] text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl" style={display}>Cada pessoa vê o que precisa para trabalhar.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {roles.map((r) => (
              <div key={r.who} className="border-l-4 border-[#12e676] pl-5">
                <h3 className="text-2xl font-extrabold tracking-tight" style={display}>{r.who}</h3>
                <p className="mt-3 max-w-[40ch] leading-7 text-[#08140e]/70">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto max-w-6xl rounded-[2rem] bg-gradient-to-br from-[#86ff62] via-[#12e676] to-[#00b394] p-8 sm:p-14">
            <h2 className="max-w-[20ch] text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-[#08140e] sm:text-5xl" style={display}>Coloque a sua equipe no mesmo mapa.</h2>
            <p className="mt-4 max-w-[50ch] text-lg leading-8 text-[#08140e]/80">Crie o ambiente da sua empresa e escolha o plano que cabe na sua operação.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/cadastro" className="gu-focus inline-flex items-center gap-2 rounded-xl bg-[#08140e] px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-[#0d2a1c]">Criar ambiente <ArrowRight className="h-4 w-4" /></a>
              <a href="/planos" className="gu-focus inline-flex items-center rounded-xl border-2 border-[#08140e] px-6 py-3.5 text-base font-bold text-[#08140e] transition hover:bg-[#08140e] hover:text-white">Ver planos</a>
              <a href="/login" className="gu-focus inline-flex items-center rounded-xl px-4 py-3.5 text-base font-bold text-[#08140e] underline-offset-4 hover:underline">Já tenho conta</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#08140e] text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <BrandLogo kind="full" height={96} className="self-start" />
          <nav className="flex flex-wrap gap-x-7 gap-y-3 text-[15px] font-semibold text-white/80" aria-label="Rodapé">
            <a href="/planos" className="hover:text-[#12e676]">Planos</a>
            <a href="/login" className="hover:text-[#12e676]">Entrar</a>
            <a href="/cadastro" className="hover:text-[#12e676]">Criar ambiente</a>
          </nav>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-sm text-white/50">© {new Date().getFullYear()} GondUp</div>
      </footer>
    </div>
  );
}
