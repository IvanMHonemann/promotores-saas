# Reestruturação de planos e permissões

## Escopo e política comercial

Manter os planos **Start**, **Profissional** e **Empresarial**, os preços mensais atuais e todos os limites numéricos atuais. Substituir a leitura ambígua de flags legadas por um catálogo único de módulos que é usado pela API, telas administrativas, planos públicos e autorização no servidor. As permissões efetivas devem continuar sujeitas ao estado da assinatura e aos limites contratados.

### Matriz proposta de módulos

| Módulo | Start | Profissional | Empresarial |
|---|---:|---:|---:|
| Painel e indicadores | Sim | Sim | Sim |
| Clientes | Sim | Sim | Sim |
| Pontos de venda / cadastro legado | Sim | Sim | Sim |
| Ordens de serviço | Sim | Sim | Sim |
| Alertas | Sim | Sim | Sim |
| Ponto eletrônico com GPS | Não | Sim | Sim |
| Operação de campo: lojas, roteiros e visitas | Não | Sim | Sim |
| Relatórios e auditoria | Não | Sim | Sim |
| Gestão da equipe e permissões individuais | Não | Sim | Sim |
| Backup e restauração | Não | Não | Sim |
| Operação offline / PWA | Não | Não | Sim |

Limites preservados do seed atual: Start — R$ 59,90/mês, 1 usuário, 1.000 clientes, 3.000 pontos de venda; Profissional — R$ 99,90/mês, 5 usuários, clientes ilimitados, 10.000 pontos de venda; Empresarial — R$ 169,90/mês, 10 usuários, clientes e pontos de venda ilimitados.

### Permissões efetivas

- A assinatura e o plano determinam os módulos liberados para a empresa; uma exceção de empresa (liberar ou bloquear módulo) pode ser gerida apenas pelo administrador da plataforma.
- A empresa pode definir por usuário `herdar`, `permitir` ou `bloquear` em cada módulo de equipe disponível. `permitir` não ultrapassa o plano/uma restrição da empresa nem o teto do papel do usuário.
- Papéis continuam definindo autoridade sobre dados e ações: `company_admin` administra a empresa; `supervisor` usa módulos operacionais dentro do tenant; `promoter` fica limitado ao painel, ponto e visitas/roteiro atribuídos. A permissão de módulo não remove filtros de tenant, papel ou titularidade já existentes.
- O plano Empresarial inclui ponto eletrônico com GPS. Se uma empresa ou membro não tiver acesso a esse módulo, tentar abrir `/ponto` deve redirecionar diretamente ao painel inicial, sem deixar a pessoa presa numa tela de bloqueio.
- Chamadas diretas à API são protegidas no servidor; esconder links na interface é apenas apresentação, não controle de segurança.

## Implementação e estrutura

- `shared/entitlements.ts`: chaves, rótulos, matriz inicial dos planos e tetos dos papéis, compartilhados por frontend e backend.
- `drizzle/schema.ts`: tabelas aditivas para recursos do plano, exceções por empresa e permissões por membro; `drizzle/0014_entitlements.sql` e o journal guardam a migração.
- `server/entitlements.ts`: cálculo de acesso efetivo, mensagens consistentes e autorização por módulo.
- `server/_core/trpc.ts`, `server/routers.ts`, `server/modules/timeTracking.ts` e `server/planLimits.ts`: aplicar a autorização e limites no servidor sem remover as verificações existentes de papel, assinatura e tenant.
- `server/db.ts`: acesso às novas tabelas; seed não destrutivo que só cria planos ausentes e não reescreve preços, limites ou recursos de planos existentes em requisições.
- `client/src/pages/AdminAssinaturasPage.tsx`: administrar módulos por plano e exceções por empresa; `AdminUsersPage.tsx`: administrar permissões individuais.
- `PublicPlansPage.tsx`, `PlansPage.tsx` e `MySubscriptionPage.tsx`: exibir os mesmos módulos/limites que a API efetivamente aplica, sem regras de apresentação baseadas no nome do plano.
- `SidebarNav.tsx` e páginas comerciais: refletir os módulos efetivos sem depender da interface para segurança.

## Dados e compatibilidade

A migração é aditiva, preserva empresas, assinaturas, preços, limites e histórico, e converte as flags antigas para o catálogo novo. Os três planos nomeados recebem a matriz proposta; planos legados fora do catálogo mantêm os recursos que foram convertidos na própria migração. O runtime não lê nem grava as colunas booleanas antigas: `subscription_plan_features` é a fonte de verdade e, se a migração não estiver aplicada, o acesso a módulos falha fechado. As colunas antigas permanecem preservadas no banco, sem uso pelo aplicativo, para evitar uma alteração destrutiva neste corte; as únicas referências executáveis restantes estão no SQL de backfill da migração e nos arquivos históricos de migração. `0014_entitlements.sql` foi aplicada e verificada no banco autorizado do projeto principal; o projeto de teste confirmou que a migração já estava aplicada. O gatilho temporário foi desarmado e removido. O runtime continua em Preview; o PR está aberto e não foi mesclado nem publicado em produção.

## Interface

Manter a linguagem visual e os componentes já usados no SaaS. Organizar a edição de recursos como matriz simples por módulo, com descrições legíveis e estado efetivo, mantendo os controles responsivos existentes; não fazer redesign visual fora do escopo.
