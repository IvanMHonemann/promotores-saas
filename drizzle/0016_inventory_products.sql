-- Cadastro tenant-scoped de produtos e controle de validade.
CREATE TABLE IF NOT EXISTS `inventory_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `productCode` varchar(64) NOT NULL,
  `description` varchar(500) NOT NULL,
  `quantity` int NOT NULL DEFAULT 0,
  `expirationDate` date NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `createdByMemberId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inventory_products_company_idx` (`companyId`),
  KEY `inventory_products_company_code_idx` (`companyId`, `productCode`),
  KEY `inventory_products_expiration_idx` (`companyId`, `expirationDate`),
  CONSTRAINT `inventory_products_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `inventory_products_creator_fk` FOREIGN KEY (`createdByMemberId`) REFERENCES `member_accounts` (`id`) ON DELETE SET NULL
);
