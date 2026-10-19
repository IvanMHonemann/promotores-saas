-- Compatível com o auto-reparo do app (idempotente em MySQL/TiDB: execute só se a coluna ainda não existir).
ALTER TABLE `inventory_products` ADD COLUMN `storeId` int NULL;
ALTER TABLE `trash_items` ADD COLUMN `deletedByMemberId` int NULL;
ALTER TABLE `trash_items` ADD COLUMN `deletedByName` varchar(255) NULL;
ALTER TABLE `trash_items` ADD COLUMN `ownerMemberId` int NULL;
