# Páginas arquivadas

Estas páginas foram removidas do fluxo ativo do aplicativo (rotas e menu) em outubro de 2026, conforme pedido:

- Planos (público e interno) — `PlansPage.tsx`, `PublicPlansPage.tsx`
- Upgrade de plano — `UpgradePlanPage.tsx`
- Minha assinatura — `MySubscriptionPage.tsx`
- Histórico de pagamentos — `PaymentHistoryPage.tsx`
- Admin de assinaturas — `AdminAssinaturasPage.tsx`
- Pagamentos da plataforma — `PlatformPaymentsPage.tsx`
- Cadastro público com pagamento — `SignupPage.tsx`

Os arquivos foram preservados aqui para reativação futura. Para voltar a usá-las, restaure as importações e rotas em `client/src/App.tsx` e os links no menu/landing.

A gestão de acesso passou a ser feita por módulos (entitlements):
- Selecionados na criação da empresa (AdminUsersPage, modo plataforma)
- Editáveis em Empresas (PlatformCompaniesPage → CompanyFeaturesCard)
- Visualizados somente leitura pelo dono da empresa em `/meus-modulos`
