-- Clientes dentro de cada loja; fotos podem apontar para um cliente (o app também cria sob demanda; idempotente).
CREATE TABLE IF NOT EXISTS `store_clients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `storeId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `contactName` varchar(255) NULL,
  `phone` varchar(50) NULL,
  `notes` text NULL,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `store_clients_company_store_idx` (`companyId`, `storeId`)
);
-- ALTER TABLE `store_photos` ADD COLUMN `storeClientId` int NULL;  (feito pelo app se a coluna não existir)
