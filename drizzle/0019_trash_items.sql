-- Lixeira (produtos e fotos de loja). Nenhuma migração anterior criava esta tabela;
-- o servidor também a cria sob demanda (ensureTrashTable), então este arquivo é idempotente.
CREATE TABLE IF NOT EXISTS `trash_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `accountId` int NOT NULL,
  `itemType` varchar(40) NOT NULL,
  `originalId` int NOT NULL,
  `label` varchar(255) NOT NULL,
  `snapshot` text NOT NULL,
  `deletedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `trash_items_account_expiry_idx` (`accountId`,`expiresAt`),
  KEY `trash_items_account_deleted_idx` (`accountId`,`deletedAt`)
);
