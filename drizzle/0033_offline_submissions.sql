-- Modo offline: idempotência e marca "registrado offline" das visitas (ver server/modules/offlineSync.ts).
-- O servidor também cria a tabela sozinho (CREATE TABLE IF NOT EXISTS) no primeiro uso.
CREATE TABLE IF NOT EXISTS `offline_submissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `companyId` int NOT NULL,
  `memberAccountId` int NULL,
  `clientId` varchar(64) NOT NULL,
  `kind` varchar(24) NOT NULL,
  `entityId` int NULL,
  `deviceTime` timestamp NULL,
  `receivedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `offline` tinyint(1) NOT NULL DEFAULT 0,
  `alert` text NULL,
  UNIQUE KEY `offline_submissions_client_unique` (`companyId`, `clientId`),
  KEY `offline_submissions_entity_idx` (`companyId`, `kind`, `entityId`)
);
