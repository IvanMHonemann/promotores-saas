ALTER TABLE `clients` ADD COLUMN `createdByUserId` int NULL;
ALTER TABLE `service_orders` ADD COLUMN `createdByUserId` int NULL;
CREATE INDEX `clients_created_by_user_idx` ON `clients` (`accountId`, `createdByUserId`);
CREATE INDEX `service_orders_created_by_user_idx` ON `service_orders` (`accountId`, `createdByUserId`);
