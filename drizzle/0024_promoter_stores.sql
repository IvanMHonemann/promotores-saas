-- Vínculo promotor ↔ loja (opcional, N:N) e fotos sem loja.
-- O servidor aplica as mesmas mudanças sob demanda (ensurePromoterStoresTable / ensureStorePhotosStoreNullable),
-- então este arquivo é idempotente e não apaga nem altera dados existentes.

-- 1) Lojas que cada promotor atende. Promotores só enxergam as lojas vinculadas a eles.
CREATE TABLE IF NOT EXISTS `promoter_stores` (
  `companyId` int NOT NULL,
  `promoterId` int NOT NULL,
  `storeId` int NOT NULL,
  `createdByMemberId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`promoterId`, `storeId`),
  KEY `promoter_stores_company_store_idx` (`companyId`, `storeId`)
);

-- 2) Preserva o acesso atual (só com a tabela vazia, para nunca recriar vínculos removidos depois):
--    lojas cadastradas pelo promotor e lojas das suas visitas. Os roteiros semanais (JSON) são migrados pelo servidor.
INSERT IGNORE INTO `promoter_stores` (`companyId`, `promoterId`, `storeId`)
SELECT x.companyId, x.promoterId, x.storeId FROM (
  SELECT so.companyId AS companyId, so.memberAccountId AS promoterId, so.storeId AS storeId
    FROM store_owners so
    JOIN member_accounts m ON m.id = so.memberAccountId AND m.companyId = so.companyId AND m.role = 'promoter'
  UNION
  SELECT v.companyId, v.promoterId, v.storeId
    FROM visits v
    JOIN member_accounts m ON m.id = v.promoterId AND m.companyId = v.companyId AND m.role = 'promoter'
) x
JOIN stores s ON s.id = x.storeId AND s.companyId = x.companyId
WHERE NOT EXISTS (SELECT 1 FROM `promoter_stores`);

-- 3) Fotos sem loja ("Sem loja vinculada"): storeId passa a aceitar NULL (apenas afrouxa a restrição).
ALTER TABLE `store_photos` MODIFY COLUMN `storeId` int NULL;
