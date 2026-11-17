# AI_CONTEXT.md

Contexto técnico conciso para continuidade do desenvolvimento.  
Última atualização: 2026-11-16. Base: `main`.

## Visão geral

SaaS multiempresa (produto GondUp) para gestão de promotores de merchandising: ponto eletrônico, roteiros, visitas, fotos de loja, produtos/validades e gestão de equipe. Lançamento oficial: 10/11/2026. Site: https://gondup.com.

Origem: plataforma anterior de gestão de extintores. O domínio de promotores é o foco atual; resquícios legados ainda existem em schema e alguns limites de plano.

## Stack

- Frontend: React 19, Vite, Tailwind, shadcn/Radix, Wouter, TanStack Query, tRPC
- Backend: Express + tRPC, Drizzle ORM, MySQL/TiDB (`mysql2`)
- Auth: sessões próprias (member + platform admin); cookie + header `x-session-token` / `Authorization: Bearer`
- Storage: S3-compatible (Cloudflare R2 em uso); backups também no R2
- Banco: TiDB em São Paulo (`sa-east-1`)
- Offline/PWA: service worker + filas em IndexedDB (Dexie e filas custom)
- E-mail: provider `console` por padrão (Resend/webhook opcionais; falta a chave do Resend)
- Cobrança: Asaas permanece em mock. O aviso de mensalidade usa Pix manual (`buildPixBrcode` / `getDefaultPixConfig`), não checkout Asaas.

## Produção e deploy

- Produção roda numa VPS da Locaweb (`vps73622`, alias SSH `gondup`), container Docker `gondup-app` em `/opt/gondup`, porta 3000. Caddy 2.11 com Let's Encrypt; `www` redireciona para o domínio raiz.
- A Vercel serve só para testes e ainda usa o mesmo banco TiDB da produção. Não apontar teste da Vercel para clientes reais. Pendência: banco de teste separado.
- O GitHub Actions (`Build de produção`) publica o artefato na branch `build/main`. O `gondup-autodeploy.timer` roda a cada 2 minutos, chama `/opt/gondup/deploy.sh`, confere `/healthz` e faz rollback se falhar. O deploy costuma levar 3 a 4 minutos. Conferir: `/opt/gondup/.deployed-sha` deve ser igual ao SHA da `main`.
- Healthcheck: `/healthz`.
- **Não reiniciar a VPS** sem avisar o Ivan: o kernel está travado.
- Variáveis principais: `EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `SCHEDULE_SECRET`, `S3_*`, `PORT`, `NODE_ENV=production`. Nunca imprimir senhas, tokens ou payload Pix.
- Se o repositório ficar privado, será preciso deploy key na VPS.

## Fluxo de trabalho no repositório

- Worktrees a partir de `/workspace/gu-fix`. Commits com `user.name="Grobot"` e `user.email="ivanhonemann09@gmail.com"`.
- Antes de mudar código, conferir o `git log` para não desfazer pedido anterior (regressões irritam o Ivan).
- Checagens: `pnpm check` (tsc), `pnpm build` e `pnpm test` (vitest). Só podem falhar `external-db` e `landingSeo`, como já acontece.
- Abrir PR, rebase se preciso, squash merge. Não commitar `node_modules` (symlink) nem `api/index.js` gerado localmente.
- Preferir soluções baratas e objetivas. Quando o Ivan disser "só isso", fazer só aquilo.

## Regras de segurança nos testes

- Usar só as empresas de teste IvanMH (`60001`) e Lisa (`120002`, em teste).
- Nunca mexer em clientes reais: PJ Promoções (`90002`) e Isael (`30001`).
- Batidas de ponto são permanentes: não criar. Nos testes em produção, não salvar nem registrar nada em empresas, salvo quando o Ivan pediu expressamente aquela alteração.
- O admin da IvanMH e o super-admin da plataforma são contas de teste do Ivan; não exibir senhas.

## Planos e limite de funcionários

Catálogo oficial em `subscription_plans` (criado/atualizado por `ensureSeedPlans()`, idempotente). Planos antigos foram desativados (`active`/`availableForNew`), nenhum foi apagado.

| Plano | id | Preço | Inclusos (`maxUsers`) | Adicional (`additionalUserPrice`) |
|---|---|---|---|---|
| GONDUP Ponto | 150003 | 199,90 | 20 | 8,00 |
| GONDUP Merchandising | 150004 | 179,90 | 20 | 8,00 |
| GONDUP Completo | 150005 | 350,00 | 20 | 12,00 |

- A empresa aponta para o plano por `companies.planId` e `company_subscriptions`. O valor negociado fica em `system_settings.monthly_amount` (`accountId` = id da empresa no schema original).
- `resolveMonthlyAmount` prefere o valor negociado, depois `subscription.amount`, depois `plan.price`.
- "Funcionários extras" é por empresa. Limite efetivo = `maxUsers` do plano + extras. Só **promotores ativos** entram na contagem. Admin e supervisor ficam de fora.
- O campo de extras e o indicador "X de Y" ficam no painel do administrador geral. Acima do limite, o cadastro de promotor é bloqueado.
- Módulos do plano: `subscription_plan_features`, com overrides em `company_feature_overrides`.
- O admin da empresa vê um card unificado "Plano e pagamento" (`/meus-modulos`). O Pix do aviso de mensalidade não aparece nesse card; só no banner da Visão geral, nos dias de lembrete.

### Plano de teste Pix (temporário)

Existe o plano oculto "Teste Pix (R$ 1)" (`id` 180003, `availableForNew=false`, módulos do Completo), guardado no banco caso precise de novo. A IvanMH voltou ao Completo (`150005`) com `monthly_amount` 350,00 na assinatura corrente (id `90001`), a pedido do Ivan em 16/11/2026. Não aplicar o plano de teste em outras empresas nem alterar os planos oficiais. Backup e instrução em `/workspace/qa/plano-teste-pix/`.

## Papéis

- `platform_admin` — administrador geral da plataforma. Empresas, usuários de todas as contas, planos, extras, avisos da plataforma, auditoria geral, e **Gerar Pix** de cobrança em cada empresa (`/admin/empresas`). Não bate ponto.
- `company_admin` — administrador da empresa. Vê as telas da operação, equipe, ponto da equipe, relatórios e Meus módulos. **Não bate ponto** e não vê ponto pessoal (UI e API; PR #115 / #129). Pode cadastrar admin, supervisor e promotor.
- `supervisor` — iguais às telas do admin da empresa, **sem** Meus módulos, pagamentos ou valores (API também recusa). **Não bate ponto**. Cadastra e edita **somente promotores** (`assertSupervisorPromoterOnly`, no servidor). Não recebe o aviso da empresa que ele mesmo criou. Fora do limite de funcionários.
- `promoter` — ponto pessoal, roteiro, lojas atribuídas, produtos, férias próprias, LGPD. Não vê menu Avisos da empresa nem billing.

`hasPersonalTimeClock` é verdadeiro só para `promoter`. `companyAdminFeatureProcedure` aceita admin ou supervisor (`requireCompanyManager`). Procedimentos de preço/fatura/Pix (`billing.plans`, `mySubscription`, `payments`, `paymentReminder`) são `companyAdminProcedure`. `billing.access` permanece sem valores.

Menu da empresa (admin e supervisor): grupos Operação, Equipe e ponto, Relatórios e Conta — sem submenus antigos de Roteiros/Cartão-ponto. Em Conta, admin e supervisor veem **Dados da empresa** (`/dados-empresa`) em primeiro lugar, depois LGPD, **Termos e privacidade** (`/termos`) e Lixeira (o admin também vê Meus módulos). O promotor agrupa Correções de ponto (`/ponto#correcoes`), Meus comprovantes e Meu espelho do mês no dropdown **Cartão ponto**, sem o item duplicado que ia para o mesmo lugar da correção, e também tem **Termos e privacidade** no menu.





## Pix gerado pelo administrador geral

Em `/admin/empresas`, o super-admin tem o botão **Gerar Pix** na lista e no detalhe de cada empresa (`platformCompanies.pixQuote` e `platformCompanies.generatePix`, só `platformProcedure`). O valor padrão é o `monthly_amount` negociado, ou o preço do plano somado aos funcionários extras (`suggestedMonthlyAmount`). A composição aparece na tela e o valor pode ser ajustado antes de gerar. O resultado reutiliza `buildPixBrcode` / `getDefaultPixConfig` (o mesmo Pix do aviso de mensalidade) e mostra QR, copia e cola e um WhatsApp `wa.me/?text=` sem número (o app pede o contato). Se a empresa tem vencimento, a cobrança é gravada em `payments` como `PENDING` (Pix); **não** marca como paga e **não** altera a validade. Empresas reais só devem receber cobrança quando o Ivan pedir.

## Bloqueio por pagamento e “acessar como empresa”

A data de bloqueio configurada no painel (vencimento + “Bloquear após atraso”) é a que vale, inclusive quando a situação da empresa é **Teste**. Um `trialEndsAt` antigo (ex.: os 14 dias da criação) não pode travar o acesso antes dessa data. Até o vencimento o acesso fica liberado; na tolerância, também, no máximo com aviso de pagamento pendente; só depois da data de bloqueio aparece a tela “Acesso bloqueado por falta de pagamento”.

O administrador geral em **Acessar como esta empresa** nunca fica preso nessa tela: entra na empresa, vê um banner com a situação e um atalho para **Gerar Pix**, e sai com **Voltar à plataforma**. Os usuários reais da empresa continuam seguindo a regra acima. A API já liberava o `actingAsPlatform`; a trava era só no `SubscriptionGate` do front, que via o super-admin como `company_admin`.

## Dados cadastrais da empresa e do funcionário

Tela **Dados da empresa** (`/dados-empresa`) e dados do membro em Promotores e equipe / Minha conta. Campos opcionais no cadastro inicial; validam formato só se preenchidos (CNPJ/CPF com dígito, PIS, CEP). Migração `0040` (colunas nullable em `companies` e `member_accounts`); `ensureCompanyRegistryColumns` é idempotente. Gravamos também em `system_settings` (`company_legal_profile` e `labor_profile:{id}`) para o espelho, AFD/AEJ e comprovantes antigos continuarem funcionando. A jornada (horário, dias, minutos) permanece no JSON do perfil trabalhista.

- Empresa: razão social, nome fantasia, CNPJ ou CPF (MEI), inscrição estadual, unidade/estabelecimento, endereço completo (CEP, logradouro, número, complemento, bairro, cidade, UF), telefone e e-mail de contato. Só o `company_admin` (ou a plataforma) edita; o supervisor consulta. Lembrete discreto só para o admin, se faltarem razão social, CNPJ/CPF ou rua+cidade; dispensável no dia; não aparece em `/dados-empresa`.
- Funcionário (todos os papéis, colunas em `member_accounts`): CPF, PIS/NIS, RG, nascimento, cargo, admissão, telefone. Admin altera qualquer membro. Supervisor altera só promotores (mesma trava de hoje). **O promotor não altera dados cadastrais**, nem os próprios: na Minha conta esses campos são só leitura. O promotor altera só e-mail (`registry.changeMyEmail`, exige senha atual) e senha. O endpoint do promotor não aceita CPF/PIS/RG etc.
- Documentos (espelho, comprovante, AFD/AEJ, Ponto: prova legal) leem primeiro as colunas, com fallback do JSON. Mensagens de pendência apontam para `/dados-empresa` e Promotores e equipe, não mais só para o Espelho de ponto. O super-admin vê razão social, CNPJ e cidade na lista de empresas.
- `/meus-dados` continua sendo a página de direitos LGPD do promotor, distinta do cadastro.

## Erros ao vivo

Painel do super-admin em `/plataforma/scanner` (menu "Erros ao vivo"). Não é mais um teste local de fachada. `server/liveErrors.ts` + `shared/liveErrorCopy.ts`.

- Lista os erros das últimas 24h e 7 dias (Sentry, org `ivanmh`, projeto `gondup`) resumidos em português: o que aconteceu, em qual tela, quantas vezes, quantos usuários, primeira e última vez em America/Sao_Paulo, gravidade (Grave / Atenção / Leve) e se está crescendo. Os termos técnicos e o link do Sentry ficam em "Ver detalhes técnicos".
- Cada erro é classificado por regras (sem IA) em **Precisa corrigir** (TypeError/ReferenceError de código, erro 500, falha de banco, chunk/build persistente, crescente ou atingindo vários usuários) ou **Normal / esperado** (rede/offline, foto de check-in que caiu por sinal fraco, GPS/câmera negados, timeout, cancelamento, extensão do navegador, ruído do service worker, sessão expirada). A razão aparece numa frase. Precisa corrigir vai no topo, em destaque; Normal fica numa seção recolhida, com a contagem e sem alarme. Ruído do service worker é agrupado.
- **Pedir correção** abre uma issue no GitHub (`IvanMHonemann/promotores-saas`), em português, com a tela, as contagens, o link do Sentry e os detalhes técnicos, com o label `erro-ao-vivo`. Se já houver issue aberta para aquele erro, o botão vira "Correção já pedida" com o link. O app **não corrige código sozinho**.
- **Marcar como normal** move o erro para a seção Normal. Se o token do Sentry tiver permissão, a issue é ignorada lá; senão a marcação fica só na tabela `live_error_overrides`. Dá para desfazer (`unmarkNormal`).
- Também mostra saúde do sistema: último backup no R2 (`backup_progress`), rotinas da madrugada (`platform_job_runs`, gravadas pelos endpoints `/api/scheduled/*`), versão no ar (`BUILD_SHA` na imagem), disco e memória vistos pelo aplicativo. Os quatro testes do aparelho (servidor, API/banco, GPS, armazenamento) continuam numa seção pequena. O "Terminal de Diagnóstico" de fachada foi removido.
- Tokens: `SENTRY_AUTH_TOKEN` (event:read, project:read; issue:write é opcional para ignorar no Sentry) e `GITHUB_ISSUES_TOKEN` (fine-grained, Issues read/write só nesse repo). Sem eles, o painel funciona com os cartões "Conexão com o Sentry pendente" e "Conexão com o GitHub pendente". Tabelas na migração `0039` (`ensureLiveErrorTables` idempotente).

## Termos de Uso e Política de Privacidade

Textos em `docs/juridico/termos-de-uso.md` e `docs/juridico/politica-de-privacidade.md`. Não editar `shared/legalTexts.ts` à mão: gerar com `scripts/gen-legal-texts.py`. Versão atual: **1.0**, vigente desde **16/11/2026** (`LEGAL_TEXT_VERSION` / `LEGAL_EFFECTIVE_DATE`). Recomenda-se revisão por advogado, principalmente ponto eletrônico (Portaria MTP 671/2021) e LGPD.

- Páginas públicas `/termos` e `/privacidade` (sem login). Já há links no rodapé da landing e na tela de login. O item de menu **Termos e privacidade** (`/termos`) aparece para super-admin, admin, supervisor e promotor.
- O **administrador da empresa** vê o modal "Atualizamos nossos Termos", com checkbox "Li e aceito os Termos de Uso e a Política de Privacidade". Pode ler os textos antes. Enquanto não aceitar, o modal reaparece a cada sessão (`sessionStorage`), mas **não bloqueia** o uso do sistema. Promotor e supervisor só têm o link. Sessão "acessar como empresa" não registra aceite.
- Registro na tabela `legal_acceptances` (migração `0038`, `ensureLegalAcceptancesTable` idempotente): versão, data/hora, usuário, empresa e IP. Se a versão mudar, o aceite é pedido de novo. Não confundir com `privacy_acknowledgements` (ciência do aviso ao trabalhador / LGPD).
- Na lista de empresas do admin geral, aparece se o admin aceitou e em qual versão.
- Fornecedor: Ivan Mateus Honemann / GondUp, Sapiranga/RS, e-mail ivan.honemann@gmail.com. **CNPJ e endereço ainda estão como [PREENCHER]** nos textos.

## Avisos

### Aviso de pagamento (automático, só o admin da empresa)

- Aparece na Visão geral nos dias `PRE_DUE_REMINDER_DAYS = [5, 3, 1]` antes do vencimento, ou se estiver atrasado/bloqueado. Fora desses dias o banner some (não é regressão).
- Card fechado: uma linha com valor e vencimento (ex.: "Mensalidade de R$ 1,00 vence em 18/11 (3 dias)"), botão "Pagar com Pix" e X para dispensar. Plural correto: "1 dia", "3 dias", "vence hoje".
- QR, copia e cola e WhatsApp só aparecem ao expandir; nada pode vazar do card no celular. Dispensar vale para o dia/chave atuais (`gondup-pay-remind:...` no localStorage) e só quando o aviso é dispensável.

### Avisos do administrador geral (`/admin/avisos`)

- Título, texto (links http/https clicáveis, sem HTML cru), tipo (informação / atenção / urgente), botão opcional, empresas (todas ou algumas), funções (admin, supervisor, promotor), período e se a pessoa pode fechar.
- Tabelas: `platform_announcements`, `platform_announcement_companies`, `platform_announcement_dismissals` (migração `0036`, `ensureAnnouncementTables` idempotente).
- O usuário vê os avisos que combinam com a empresa e a função, no topo da Visão geral, compactos como o do Pix. Dispensa por usuário (`memberAccountId`).

### Avisos da empresa (`/avisos`)

- Menu em Operação, para admin e supervisor. Só atinge **promotores e supervisores da própria empresa**. Dá para escolher funções ou pessoas específicas. Não há seletor de empresa: o servidor usa `ctx.accountId`.
- O admin da empresa **não é alvo**. O autor não recebe o próprio aviso. O admin edita todos os avisos da empresa; o supervisor, só os que criou. O promotor não cria.
- Colunas extras na mesma tabela (`source`, `companyId`, `createdByMemberAccountId`, `targetMode`) e `platform_announcement_members` (migração `0037`, aditivas). IDs de outra empresa ou de admin são recusados.
- No banner: "Aviso de [autor] ([empresa])" ou "Aviso da GondUp". No painel do admin geral, a lista filtra origem (plataforma / empresas), mas avisos da empresa só se gerenciam no painel da empresa.

## Contraste e UI

No tema escuro, botões de ação usam fundo `bg-teal-300` com texto `text-slate-950` (não branco sobre verde claro). Contraste alvo ≥ 4,5:1 (PR #128). Não reverter isso em telas novas.

Datas visíveis ao usuário ficam em português do Brasil (`pt-BR`, fuso `America/Sao_Paulo`). No Cartão-ponto do admin/supervisor, o estado de carregamento é "Carregando promotores...", não "Nenhum promotor cadastrado". O espelho do promotor abre no mês fechado de propósito; o mês atual continua no seletor.

Landing: bloco "Siga nossa página no Instagram" e ícone no rodapé para https://instagram.com/gondup.app; o FAQ mantém o "+" ao lado das perguntas; o rodapé usa `pb-32` para não ficar atrás dos botões flutuantes.

## Arquitetura

- Multi-tenant por `companyId` / `accountId` (isolamento no backend; não confiar só no frontend).
- Entitlements: plano da empresa + override de empresa + permissão por membro (`inherit` / `allow` / `deny`). Teto por papel.
- Acesso a lojas (`server/storeAccess.ts`): admin e supervisor veem todas; promotor, só `promoter_store_assignments`. Cadastro de lojas: admin e supervisor.
- Fotos: promotor vê as próprias; admin/supervisor veem as da empresa. `storeId` nullable (“Sem loja vinculada”).
- Algumas tabelas são criadas sob demanda (`ensure*Table`) para compatibilidade com bancos já existentes.
- Build: `vite build` (saída em `dist/public`) + esbuild do server (`dist/index.js`) e do entry Vercel.
- Servidor inicia HTTP apenas quando não detecta `process.env.VERCEL`.

### Principais tabelas (`drizzle/schema.ts`)

`companies`, `memberAccounts`, `promoterProfiles`, `clients`, `brands`, `retailChains`, `stores`, `teams`, `routes`, `weeklyRouteSchedules`, `visits`, `timeEvents`, `timeCorrectionRequests`, `storePhotos`, `visitPhotos`, `inventoryProducts`, `checklists` (+ questions/responses), `evidences`, `auditLogs`, `vacationSchedules`, planos/assinaturas/entitlements, `platform_announcements` e tabelas auxiliares de aviso, `legal_acceptances`, `live_error_overrides`, `platform_job_runs`.

Tabelas auxiliares (criadas em runtime quando necessário): `store_owners`, `promoter_store_assignments`, entre outras.

### Módulos / routers relevantes

- `server/modules/timeTracking.ts` — ponto
- `server/modules/timesheetMirror.ts` — espelho de ponto
- `server/modules/timesheetArchive.ts` — arquivamento histórico de espelhos (PDF + R2)
- `server/modules/correctionExtras.ts` — tipo de justificativa e anexo em correções
- `server/modules/vacations.ts` — programação de férias
- `server/modules/storePhotos.ts` / `server/modules/storeClients.ts`
- `server/modules/platformCompanies.ts` — empresas da plataforma
- `server/platformAnnouncements.ts` / `server/modules/platformAnnouncements.ts` / `shared/platformAnnouncements.ts` — avisos
- `shared/paymentReminderCopy.ts` / `server/paymentReminder.ts` — aviso de mensalidade
- `shared/holidays.ts` — feriados nacionais (espelho e abono)
- `server/storeAccess.ts`, `server/storage.ts`, `server/entitlements.ts` / `shared/entitlements.ts`
- `server/supervisorTeam.ts` — supervisor só gerencia promotores
- `shared/personalPonto.ts` — quem tem ponto pessoal
- `server/liveErrors.ts` / `shared/liveErrorCopy.ts` — painel Erros ao vivo
- `server/routers.ts` — `appRouter`

## Funcionalidades implementadas (além do que está nas seções acima)

- Auth: signup (empresa + admin, trial), login, recuperação, avatar, menu de conta unificado, sessão por cookie + token.
- Ponto: sequência do dia, saída automática de jornadas de dias anteriores, solicitação/inclusão de batidas esquecidas, espelho, alertas de batida faltante (dismiss persistido). O histórico e o cartão-ponto usam o dia civil de **America/Sao_Paulo** (não meia-noite UTC): uma saída às 23:55 entra no dia certo. Pedido novo da mesma batida só é recusado se ainda houver um **pendente**; pedido já aprovado não bloqueia um novo envio. No cartão-ponto, a correção usa calendário próprio (pt-BR, domingo no início, tema escuro): o mês do promotor vem de um endpoint só dele e sinaliza dias que precisam de correção (ponto âmbar) ou que já têm pedido pendente (ponto azul). Dias futuros ficam bloqueados. No aviso do admin/supervisor, cada promotor tem “Notificar promotor”, sempre ativo: no celular tenta `navigator.share({ text })` para escolher o contato na folha de compartilhamento; se não houver share (ou no desktop), abre `https://wa.me/?text=…` sem número, e o WhatsApp pede o contato. Não usa telefone cadastrado. A mensagem pronta (data e batidas faltantes) continua igual. O cartão-ponto continua acessível pelo nome. Nada é enviado automaticamente. O promotor vê o aviso pessoal com “Solicitar correção”, nunca o de notificar a equipe. Plural: “1 funcionário” / “N funcionários”. Feriados nacionais identificados automaticamente: falta de batida em feriado é abonada e o ponto continua liberado. Correções/inclusões aceitam tipo de justificativa (`normal` / `feriado` / `folga` / `atestado`) e anexo de foto. Abono de dia inteiro. Alerta de batida faltante do admin some quando há correção ou abono cobrindo o dia. Correções da mesma data podem ser aprovadas/recusadas juntas. Promotor vê aviso de correção recusada. Espelhos podem ser arquivados (PDF + hash + R2) em `/arquivos-historicos`.
- Programação de férias (v1): admin e supervisor cadastram, editam e cancelam períodos dos funcionários ativos. Promotor só consulta as próprias (`/minhas-ferias`). Sem solicitação/aprovação pelo funcionário, sem saldo legal nem pagamento nesta versão. Tabela `vacation_schedules` (criada sob demanda).
- Lojas, clientes de loja, roteiros semanais, visitas, check-in/out com foto de fachada. Regras de visita em andamento, compressão da foto, idempotência e fila offline: ver histórico do arquivo e `docs/visit-checkin-module.md`.
- Fotos de loja: marca d’água, galeria, exclusão, expiração (~60 dias), relatório PDF, foto sem loja.
- Vínculo promotor ↔ lojas (opcional) na criação e na edição; alterações refletem imediatamente no acesso.
- Dashboards da Central: lojas, fotos, produtos a vencer, visitas e alertas de validade, sem ranking de promotores.
- Offline: cadastro de lojas/clientes, sincronização de visitas, fila de fotos, cache de roteiro do dia.
- Produtos e validades (com lixeira). Auditoria append-only. PWA com fallback offline.
- Termos de Uso e Política de Privacidade (versão 1.0) nas páginas públicas e no menu de todos os papéis, com aceite registrado do admin da empresa (`legal_acceptances`).
- O administrador geral gera um Pix de cobrança em `/admin/empresas` (QR, copia e cola e WhatsApp), com o valor do plano; a cobrança fica pendente até o pagamento ser registrado.
- Cadastro da empresa (`/dados-empresa`) e dados do funcionário (CPF, PIS, RG, cargo, admissão) em Promotores e equipe. O promotor só edita e-mail e senha; o admin altera o cadastro do promotor (o supervisor, só de promotores). Documentos oficiais passam a usar esses dados.
- Painel Erros ao vivo do super-admin (`/plataforma/scanner`): resumo em português, classificação Precisa corrigir vs Normal, pedido de correção no GitHub e marcação como normal, mais saúde do sistema (backup, rotinas, versão, disco e memória).
- Platform admin escolhe `featureKeys` na criação da empresa e edita módulos em `CompanyFeaturesCard`. Ações "Nova empresa", "Novo usuário" e "Redefinir senha" no painel do admin geral devem permanecer visíveis (já foram removidas por engano e restauradas no PR #125).

## Decisões importantes

- Isolamento multi-tenant rigoroso no backend.
- Hooks de sync (`useVisitSync`, `usePhotoSync`): `useMutation()` muda de identidade a cada render; não usá-lo como dependência de `useEffect`.
- Filas offline lançam erro quando o localStorage está cheio; quem enfileira deve tratar.
- Recarregamento automático do PWA (`controllerchange` em `main.tsx`) espera `window.__gondupUploading` zerar (máx. ~35 s).
- Sessão via cookie + header para compatibilidade com Vercel e clientes PWA.
- `storeId` nullable em fotos para não bloquear captura.
- Schema legado de extintores preservado (`schema.original.ts` e algumas colunas/limites) para não quebrar dados antigos.
- Tabelas auxiliares criadas sob demanda para reduzir dependência de migrações manuais em produção.
- Férias v1 é só programação operacional: não altera cartão-ponto, não calcula saldo legal e não gera pagamento.
- Erro de uma tela não pode derrubar o app: `ErrorBoundary` reseta na troca de rota; fundo do `body` é `#07111f`.
- Espelho de ponto usa dia local `America/Sao_Paulo` e perfil trabalhista; jornada aberta de hoje não entra no saldo.
- Páginas comerciais antigas de planos/checkout público estão em `client/src/pages/_archived/`. A cobrança atual da empresa é o card "Plano e pagamento" + aviso Pix, não esse fluxo arquivado.

## Problemas conhecidos e pendências

- Resquícios do domínio de extintores ainda existem (schema original, alguns limites como `maxExtinguishers`).
- Conformidade do ponto com a Portaria MTP 671/2021 (REP) não foi validada juridicamente; o módulo é base técnica.
- Asaas ainda em modo mock; e-mail em modo console por padrão. Falta a chave do Resend.
- Banco de teste separado para a Vercel; RAM da VPS ainda em 2 GB (pedido de 4 GB pendente).
- `store_photos.idempotencyKey` não tem índice único: a deduplicação no servidor é select-then-insert (sujeita a corrida). Mitigado no cliente.
- Limite de corpo da Vercel (~4,5 MB): `uploadAndCreate` recusa `imageBase64` > 6 MB; fotos de check-in ficam em ~80–250 KB.
- Criação sob demanda de algumas tabelas pode adicionar latência no primeiro acesso.
- Checklists dinâmicos e evidências genéricas estão no schema, mas o fluxo completo de produto ainda é parcial.
- Google Maps é opcional (`VITE_GOOGLE_MAPS_API_KEY`).
- Testes de banco exigem `EXTERNAL_DATABASE_URL`; a suíte completa não roda sem ambiente configurado. `landingSeo` também costuma falhar (texto da landing mudou).
- Sobreposição de férias é check-then-act dentro de transação, sem `SELECT FOR UPDATE`.
- Endereços das lojas e silenciar o erro do service worker no Sentry continuam pendentes. No painel Erros ao vivo esse ruído já entra como Normal / esperado e é agrupado.
- Para o painel Erros ao vivo listar erros reais e abrir issue de correção, faltam `SENTRY_AUTH_TOKEN` e `GITHUB_ISSUES_TOKEN` no `.env` da VPS (o DSN do Sentry já existe). Sem eles, o painel mostra conexão pendente e o resto da saúde do sistema funciona.
- Nos Termos e na Política, CNPJ e endereço do fornecedor ainda estão como `[PREENCHER]`. Os textos valem revisão de um advogado antes do uso formal com clientes.

## Como manter este arquivo

Atualizar somente quando houver mudança relevante de arquitetura, funcionalidade, decisão ou pendência. Preservar informações anteriores que continuem válidas. Não incluir segredos, tokens, senhas ou trechos longos de conversa. Não criar outro arquivo de contexto (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`) se este já existir.

## Ponto com valor de prova

Ver docs/ponto-prova-legal.md. Regra: NUNCA dar UPDATE/DELETE em time_events originais; correções via appendTreatment (server/ponto/ledger.ts). Batidas novas só via appendOriginalPunch.
