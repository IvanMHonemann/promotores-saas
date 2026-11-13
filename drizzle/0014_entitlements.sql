-- Catálogo normalizado de recursos por plano, empresa e membro. Migração somente aditiva.
CREATE TABLE IF NOT EXISTS `subscription_plan_features` (
  `id` int AUTO_INCREMENT NOT NULL,
  `planId` int NOT NULL,
  `featureKey` varchar(64) NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscription_plan_features_plan_feature_unique` (`planId`, `featureKey`),
  KEY `subscription_plan_features_plan_idx` (`planId`),
  CONSTRAINT `subscription_plan_features_plan_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_feature_overrides` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `featureKey` varchar(64) NOT NULL,
  `enabled` boolean NOT NULL,
  `reason` text,
  `updatedByPlatformAdminId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_feature_overrides_company_feature_unique` (`companyId`, `featureKey`),
  KEY `company_feature_overrides_company_idx` (`companyId`),
  CONSTRAINT `company_feature_overrides_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `company_feature_overrides_platform_admin_fk` FOREIGN KEY (`updatedByPlatformAdminId`) REFERENCES `platform_admins` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member_feature_permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `memberAccountId` int NOT NULL,
  `featureKey` varchar(64) NOT NULL,
  `mode` enum('allow','deny') NOT NULL,
  `updatedByMemberAccountId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `member_feature_permissions_member_feature_unique` (`memberAccountId`, `featureKey`),
  KEY `member_feature_permissions_member_idx` (`memberAccountId`),
  CONSTRAINT `member_feature_permissions_member_fk` FOREIGN KEY (`memberAccountId`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `member_feature_permissions_updated_by_fk` FOREIGN KEY (`updatedByMemberAccountId`) REFERENCES `member_accounts` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
-- Migra as flags existentes para planos legados fora da matriz comercial principal.
INSERT INTO `subscription_plan_features` (`planId`, `featureKey`, `enabled`)
SELECT `id`, 'dashboard', `featureDashboard` FROM `subscription_plans`
UNION ALL SELECT `id`, 'clients', `featureClients` FROM `subscription_plans`
UNION ALL SELECT `id`, 'pointsOfSale', `featureExtinguishers` FROM `subscription_plans`
UNION ALL SELECT `id`, 'serviceOrders', `featureServiceOrders` FROM `subscription_plans`
UNION ALL SELECT `id`, 'alerts', `featureAlerts` FROM `subscription_plans`
UNION ALL SELECT `id`, 'reports', `featureReports` FROM `subscription_plans`
UNION ALL SELECT `id`, 'teamManagement', `featureUsers` FROM `subscription_plans`
UNION ALL SELECT `id`, 'backup', `featureBackup` FROM `subscription_plans`
UNION ALL SELECT `id`, 'offline', `featureOfflinePwa` FROM `subscription_plans`
UNION ALL SELECT `id`, 'timeTracking', false FROM `subscription_plans`
UNION ALL SELECT `id`, 'fieldOperations', false FROM `subscription_plans`
ON DUPLICATE KEY UPDATE `enabled` = VALUES(`enabled`);
--> statement-breakpoint
-- Matriz inicial dos planos atuais; preços, limites, empresas e assinaturas não são alterados.
INSERT INTO `subscription_plan_features` (`planId`, `featureKey`, `enabled`)
SELECT p.`id`, matrix.`featureKey`, matrix.`enabled`
FROM `subscription_plans` p
JOIN (
  SELECT 'start' AS `planName`, 'dashboard' AS `featureKey`, 1 AS `enabled` UNION ALL
  SELECT 'start', 'clients', 1 UNION ALL
  SELECT 'start', 'pointsOfSale', 1 UNION ALL
  SELECT 'start', 'serviceOrders', 1 UNION ALL
  SELECT 'start', 'alerts', 1 UNION ALL
  SELECT 'start', 'timeTracking', 0 UNION ALL
  SELECT 'start', 'fieldOperations', 0 UNION ALL
  SELECT 'start', 'reports', 0 UNION ALL
  SELECT 'start', 'teamManagement', 0 UNION ALL
  SELECT 'start', 'backup', 0 UNION ALL
  SELECT 'start', 'offline', 0 UNION ALL
  SELECT 'profissional', 'dashboard', 1 UNION ALL
  SELECT 'profissional', 'clients', 1 UNION ALL
  SELECT 'profissional', 'pointsOfSale', 1 UNION ALL
  SELECT 'profissional', 'serviceOrders', 1 UNION ALL
  SELECT 'profissional', 'alerts', 1 UNION ALL
  SELECT 'profissional', 'timeTracking', 1 UNION ALL
  SELECT 'profissional', 'fieldOperations', 1 UNION ALL
  SELECT 'profissional', 'reports', 1 UNION ALL
  SELECT 'profissional', 'teamManagement', 1 UNION ALL
  SELECT 'profissional', 'backup', 0 UNION ALL
  SELECT 'profissional', 'offline', 0 UNION ALL
  SELECT 'empresarial', 'dashboard', 1 UNION ALL
  SELECT 'empresarial', 'clients', 1 UNION ALL
  SELECT 'empresarial', 'pointsOfSale', 1 UNION ALL
  SELECT 'empresarial', 'serviceOrders', 1 UNION ALL
  SELECT 'empresarial', 'alerts', 1 UNION ALL
  SELECT 'empresarial', 'timeTracking', 1 UNION ALL
  SELECT 'empresarial', 'fieldOperations', 1 UNION ALL
  SELECT 'empresarial', 'reports', 1 UNION ALL
  SELECT 'empresarial', 'teamManagement', 1 UNION ALL
  SELECT 'empresarial', 'backup', 1 UNION ALL
  SELECT 'empresarial', 'offline', 1
) AS matrix ON LOWER(TRIM(p.`name`)) = matrix.`planName`
ON DUPLICATE KEY UPDATE `enabled` = VALUES(`enabled`);
