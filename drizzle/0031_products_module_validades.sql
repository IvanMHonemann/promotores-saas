-- Módulo "Produtos e validades" (featureKey `products`) e campos novos do controle de validade.
-- Número 0031 escolhido para não colidir com os 0027 dos PRs #57, #58 e #60.
-- O app aplica o mesmo conteúdo sozinho (ensureProductsFeature / ensureInventoryProductsSchema), então rodar à mão é opcional.

-- 1) Default ON: todos os planos existentes passam a incluir o módulo (nenhum cliente perde a tela que já usa).
INSERT INTO `subscription_plan_features` (`planId`, `featureKey`, `enabled`)
SELECT p.`id`, 'products', 1
FROM `subscription_plans` p
WHERE NOT EXISTS (
  SELECT 1 FROM `subscription_plan_features` x WHERE x.`planId` = p.`id` AND x.`featureKey` = 'products'
);

-- 2) Produto ligado à indústria (cliente da loja), lote e foto da etiqueta.
--    (execute cada ALTER só se a coluna ainda não existir)
ALTER TABLE `inventory_products` ADD COLUMN `storeClientId` int NULL;
ALTER TABLE `inventory_products` ADD COLUMN `lot` varchar(64) NULL;
ALTER TABLE `inventory_products` ADD COLUMN `photoKey` varchar(512) NULL;
CREATE INDEX `inventory_products_merge_idx` ON `inventory_products` (`companyId`, `productCode`, `expirationDate`);
CREATE INDEX `inventory_products_client_idx` ON `inventory_products` (`companyId`, `storeClientId`);

-- 3) Idempotência dos cadastros (UUID gerado no aparelho): reenvio não duplica nem soma duas vezes.
CREATE TABLE IF NOT EXISTS `inventory_product_requests` (
  `companyId` int NOT NULL,
  `clientRequestId` varchar(64) NOT NULL,
  `productId` int NOT NULL,
  `merged` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`companyId`, `clientRequestId`)
);

-- 4) Janela de alerta por empresa: system_settings.settingKey = 'products_alert_days' (padrão 30, sem linha = 30).
