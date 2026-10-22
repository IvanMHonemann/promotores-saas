import { ArrowRight, CalendarCheck, Camera, MapPinned, Users, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <img src="/gondup-logo.png" alt="GONDUP" className="h-16" />
          <div className="flex gap-4">
            <button className="text-sm text-white/70 hover:text-white" onClick={() => window.location.href = "/login"}>Entrar</button>
            <Button className="bg-emerald-500 text-black hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>Começar</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <img src="/gondup-logo.png" alt="GONDUP" className="mx-auto h-28 sm:h-36" />
        <p className="mt-6 text-2xl font-medium text-white">
          Da gôndola ao trade. <span className="text-emerald-400">Seu próximo upgrade.</span>
        </p>
        <h1 className="mt-10 text-4xl font-bold leading-tight sm:text-5xl">
          Controle de ponto, roteiros e evidências para equipes de campo
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          A GONDUP ajuda agências e indústrias a gerenciar promotores, acompanhar visitas e registrar a execução no ponto de venda.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Button className="h-12 bg-emerald-500 px-6 text-black hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>
            Criar ambiente <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-12 border-white/20 px-6 text-white hover:bg-white/10" onClick={() => window.location.href = "/login"}>
            Já tenho conta
          </Button>
        </div>
      </section>

      {/* Recursos */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold">O que a GONDUP faz</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: "Ponto eletrônico", text: "Entrada, intervalo e saída com localização. Alerta de batida faltante." },
              { icon: MapPinned, title: "Roteiros", text: "Programe visitas por dia da semana e distribua lojas para cada promotor." },
              { icon: Camera, title: "Fotos com evidência", text: "Registre a execução com marca d'água, data e local. Compartilhe no WhatsApp." },
              { icon: Users, title: "Equipes", text: "Cadastre promotores, defina horários e acompanhe quem está em campo." },
              { icon: CalendarCheck, title: "Cartão-ponto", text: "Histórico mensal, horas trabalhadas e aprovação de correções." },
              { icon: CheckCircle2, title: "Painel", text: "Indicadores de jornada, fotos e produtos próximos do vencimento." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-white/10 p-6">
                <Icon className="h-6 w-6 text-emerald-400" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/50">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold">Comece agora</h2>
          <p className="mt-3 text-white/50">Crie o ambiente da sua empresa e organize a operação de campo.</p>
          <Button className="mt-6 h-12 bg-emerald-500 px-8 text-black hover:bg-emerald-400" onClick={() => window.location.href = "/cadastro"}>
            Criar ambiente <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/40">
        GONDUP · Da gôndola ao trade. Seu próximo upgrade.
      </footer>
    </main>
  );
}
