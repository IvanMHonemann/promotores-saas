import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";

function Item({ ok, title, hint }: { ok: boolean; title: string; hint: string }) {
  return (
    <li className="flex gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
      <span><b className="text-white">{title}</b> <span className="text-slate-400">— {hint}</span></span>
    </li>
  );
}

/**
 * Só para o administrador da plataforma (Ivan): pendências do dono do sistema
 * (INPI, documento do desenvolvedor, certificado). A empresa cliente não vê esta tela.
 */
export default function PlatformPontoLegalPage() {
  const status = trpc.pontoLegal.platformStatus.useQuery();
  const s = status.data;

  return (
    <DashboardLayout
      title="Ponto legal (plataforma)"
      description="Pendências do GondUp como desenvolvedor do ponto eletrônico — não aparece para as empresas clientes."
    >
      <div className="space-y-4 text-white">
        <Card className="border-amber-300/25 bg-amber-400/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-100">
              <ShieldAlert className="h-4 w-4" /> Só você vê isto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p>
              Estes itens são obrigação do dono do programa (REP-P / Portaria 671), não da empresa cliente.
              Enquanto estiverem pendentes, os arquivos AFD/AEJ e os comprovantes ainda saem sem a formalidade completa —
              mas o lacre das batidas e o espelho já ajudam numa defesa.
            </p>
            {status.isLoading && <p className="text-slate-400">Carregando...</p>}
            {s && (
              <ul className="space-y-2">
                <Item
                  ok={Boolean(s.inpiNumber)}
                  title="Registro do programa no INPI"
                  hint={s.inpiNumber ? `nº ${s.inpiNumber}` : "pendente — obrigatório para dizer que o ponto é REP-P oficial (art. 91 da Portaria 671)"}
                />
                <Item
                  ok={s.developerDocument}
                  title="CNPJ/CPF do desenvolvedor"
                  hint={s.developerDocument ? `${s.developerName || "configurado"}` : "pendente — configure a variável de ambiente GONDUP_DEVELOPER_DOCUMENT"}
                />
                <Item
                  ok={s.signature}
                  title="Assinatura ICP-Brasil (.p7s) do AFD/AEJ"
                  hint={s.signature ? "ativa" : "pendente — precisa de certificado digital; até lá os arquivos saem sem assinatura"}
                />
                <Item
                  ok={s.emailEnabled}
                  title="Envio de comprovante por e-mail"
                  hint={s.emailEnabled ? "ativo" : "desativado neste ambiente (RESEND_API_KEY / EMAIL_WEBHOOK_URL)"}
                />
              </ul>
            )}
            <p className="text-xs text-slate-400">
              Variáveis: GONDUP_INPI_NUMBER, GONDUP_DEVELOPER_DOCUMENT, GONDUP_DEVELOPER_NAME, GONDUP_DEVELOPER_EMAIL, GONDUP_PTRP_VERSION.
              A tela da empresa (/ponto-legal) mostra só o que ela mesma pode cadastrar.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
