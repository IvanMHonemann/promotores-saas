import { FileText, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/pages/AuthShell";

type Kind = "termos" | "privacidade";

/**
 * RASCUNHO — páginas provisórias de Termos de Uso e Política de Privacidade.
 * O texto abaixo é um esqueleto genérico, NÃO tem validade jurídica e deve ser
 * revisado/substituído por um advogado antes de receber clientes pagantes (LGPD).
 */
const CONTENT: Record<Kind, { title: string; sections: Array<{ h: string; p: string }> }> = {
  termos: {
    title: "Termos de Uso",
    sections: [
      { h: "1. Objeto", p: "O GondUp é um serviço online de gestão de equipes de campo (roteiros, visitas, ponto eletrônico e validade de produtos), contratado por empresas." },
      { h: "2. Contas e acesso", p: "As contas são criadas pelo administrador. Cada usuário é responsável por manter a confidencialidade da sua senha." },
      { h: "3. Planos e pagamento", p: "[A definir: valores, forma de cobrança, prazos, cancelamento e reembolso.]" },
      { h: "4. Responsabilidades", p: "[A definir: responsabilidades da plataforma e do cliente, disponibilidade do serviço, limitação de responsabilidade.]" },
      { h: "5. Foro", p: "[A definir.]" },
    ],
  },
  privacidade: {
    title: "Política de Privacidade",
    sections: [
      { h: "1. Dados tratados", p: "Dados cadastrais (nome, e-mail), registros de ponto, localização (GPS) no momento das marcações e visitas, fotos de lojas e produtos." },
      { h: "2. Finalidade e base legal", p: "[A definir com assessoria jurídica: finalidades e bases legais da LGPD (Lei 13.709/2018) para cada tratamento, em especial a geolocalização.]" },
      { h: "3. Compartilhamento e armazenamento", p: "[A definir: operadores/subprocessadores (hospedagem, banco de dados, e-mail), local de armazenamento e prazo de retenção.]" },
      { h: "4. Direitos do titular", p: "[A definir: como solicitar acesso, correção, exclusão e portabilidade dos dados; contato do encarregado (DPO).]" },
    ],
  },
};

export default function LegalPage({ kind }: { kind: Kind }) {
  const c = CONTENT[kind];
  return (
    <AuthShell title={c.title} icon={kind === "termos" ? <FileText /> : <ShieldCheck />} backTo="/" backLabel="Voltar ao início">
      <div role="note" className="mb-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">
        RASCUNHO — revisar com advogado. Este texto é provisório e não tem validade jurídica.
      </div>
      <div className="space-y-4 text-sm leading-6 text-slate-300">
        {c.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-bold text-white">{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}
      </div>
    </AuthShell>
  );
}
