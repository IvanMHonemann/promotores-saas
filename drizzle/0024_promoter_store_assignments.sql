-- Vínculo opcional de lojas a promotores. Criada sob demanda também pelo servidor.
CREATE TABLE IF NOT EXISTS `promoter_store_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `promoterId` int NOT NULL,
  `storeId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `promoter_store_unique` (`promoterId`, `storeId`),
  KEY `promoter_store_company_promoter_idx` (`companyId`, `promoterId`),
  KEY `promoter_store_company_store_idx` (`companyId`, `storeId`)
);

-- Permite fotos sem loja vinculada
ALTER TABLE `store_photos` MODIFY `storeId` int NULL;
