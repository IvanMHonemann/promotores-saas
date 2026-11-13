# GitHub Sync Status (2026-10-04 ~10:30)

## Já no remote (main) nesta sessão
### Server
- _core: context, cookies, systemRouter, trpc, notification, index
- asaas, seed, storage, email, subscriptionAccess, scheduledMaintenance, vercel-entry
- memberAuth.ts → .sync-parts (2 parts gzip+b64) — rodar reassemble

### Drizzle
- schema.ts → .sync-parts (2 parts) — rodar reassemble

### Client
- main.tsx, App.tsx, useAuth, LandingPage, NotFound, PrintOrderPage
- PlansPage, PaymentHistoryPage, MySubscriptionPage
- home/* (ClientDetailCard, types, utils, index)
- ThemeContext, hooks (useMobile, usePersistFn, useComposition)
- BrandLogo, ErrorBoundary, PasswordInput, PwaStatusBar, DashboardLayoutSkeleton
- UI: skeleton, label, separator, checkbox, alert, popover, scroll-area, badge, button, card, input

### Scripts
- reassemble-sync-parts.py (atualizado: usa target+stem)
- fetch-landing.sh, deploy-*.sh

### .sync-parts (reassemble)
- server/db.ts (5), routers.ts (3), Home.tsx (10)
- server/memberAuth.ts (2), drizzle/schema.ts (2)

## Ainda faltam
1. Páginas: Signup, Upgrade, PublicPlans, SyncStatus, Backup, AdminUsers, AdminAssinaturas
2. DashboardLayout, ServiceOrderDocument, AIChatBox, Map
3. UI restante (~40 arquivos shadcn)
4. index.css, offline/*, vite.ts
5. Migrations SQL drizzle/
6. client/public (sw.js, manifest, icons) — landing via fetch-landing.sh

## Clone utilizável (parcial)
```bash
git clone https://github.com/IvanMHonemann/gestao-extintores-saas.git
cd gestao-extintores-saas
python3 scripts/reassemble-sync-parts.py
bash scripts/fetch-landing.sh
# ainda faltam vários fontes — sync em andamento
pnpm install
```

## Fonte da verdade
- Produção: https://gestao-de-extintores-pi.vercel.app
- Local completo: artifacts/gestao-extintores
