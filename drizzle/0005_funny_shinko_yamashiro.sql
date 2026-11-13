ALTER TABLE `system_settings` DROP INDEX `system_settings_settingKey_unique`;--> statement-breakpoint
-- Os três clientes sem accountId são os registros demonstrativos criados por server/seed.ts.
-- A associação com a conta administrativa id=1 é determinística pelos IDs e nomes do seed.
UPDATE `clients` SET `accountId` = 1
WHERE `accountId` IS NULL
  AND `id` = 1 AND `companyName` = 'Padaria e Confeitaria Central' AND `cnpj` = '18.345.982/0001-44';--> statement-breakpoint
UPDATE `clients` SET `accountId` = 1
WHERE `accountId` IS NULL
  AND `id` = 2 AND `companyName` = 'Metalúrgica Vale dos Sinos' AND `cnpj` = '09.123.456/0001-89';--> statement-breakpoint
UPDATE `clients` SET `accountId` = 1
WHERE `accountId` IS NULL
  AND `id` = 3 AND `companyName` = 'Auto Peças Progresso' AND `cnpj` = '33.789.012/0001-11';--> statement-breakpoint
ALTER TABLE `clients` MODIFY COLUMN `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `extinguishers` ADD `accountId` int NULL;--> statement-breakpoint
UPDATE `extinguishers` e INNER JOIN `clients` c ON c.id = e.clientId SET e.accountId = c.accountId WHERE e.accountId IS NULL;--> statement-breakpoint
ALTER TABLE `extinguishers` MODIFY COLUMN `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `service_orders` ADD `accountId` int NULL;--> statement-breakpoint
UPDATE `service_orders` o INNER JOIN `clients` c ON c.id = o.clientId SET o.accountId = c.accountId WHERE o.accountId IS NULL;--> statement-breakpoint
ALTER TABLE `service_orders` MODIFY COLUMN `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `accountId` int NULL;--> statement-breakpoint
UPDATE `system_settings` SET `accountId` = 1 WHERE `accountId` IS NULL;--> statement-breakpoint
ALTER TABLE `system_settings` MODIFY COLUMN `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_account_key_unique` UNIQUE(`accountId`,`settingKey`);--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_accountId_member_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `member_accounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_accountId_member_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `member_accounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_sessions` ADD CONSTRAINT `member_sessions_accountId_member_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_order_items` ADD CONSTRAINT `service_order_items_serviceOrderId_service_orders_id_fk` FOREIGN KEY (`serviceOrderId`) REFERENCES `service_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_accountId_member_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `member_accounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_accountId_member_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `clients_account_idx` ON `clients` (`accountId`);--> statement-breakpoint
CREATE INDEX `clients_account_city_idx` ON `clients` (`accountId`,`city`);--> statement-breakpoint
CREATE INDEX `extinguishers_account_idx` ON `extinguishers` (`accountId`);--> statement-breakpoint
CREATE INDEX `extinguishers_client_idx` ON `extinguishers` (`clientId`);--> statement-breakpoint
CREATE INDEX `extinguishers_account_expiration_idx` ON `extinguishers` (`accountId`,`expirationDate`);--> statement-breakpoint
CREATE INDEX `member_sessions_account_expiry_idx` ON `member_sessions` (`accountId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `service_order_items_order_idx` ON `service_order_items` (`serviceOrderId`);--> statement-breakpoint
CREATE INDEX `service_orders_account_idx` ON `service_orders` (`accountId`);--> statement-breakpoint
CREATE INDEX `service_orders_client_idx` ON `service_orders` (`clientId`);--> statement-breakpoint
CREATE INDEX `service_orders_account_date_idx` ON `service_orders` (`accountId`,`orderDate`);--> statement-breakpoint
CREATE INDEX `service_orders_account_number_idx` ON `service_orders` (`accountId`,`orderNumber`);--> statement-breakpoint
CREATE INDEX `system_settings_account_idx` ON `system_settings` (`accountId`);
