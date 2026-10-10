CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`recoveryCodeHash` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admins_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `platform_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platformAdminId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
INSERT INTO `companies` (`id`, `name`, `active`, `createdAt`, `updatedAt`) VALUES
	(1, 'Administração', true, NOW(), NOW()),
	(30001, 'Isael', true, NOW(), NOW());
--> statement-breakpoint
ALTER TABLE `clients` DROP FOREIGN KEY `clients_accountId_member_accounts_id_fk`;
--> statement-breakpoint
ALTER TABLE `extinguishers` DROP FOREIGN KEY `extinguishers_accountId_member_accounts_id_fk`;
--> statement-breakpoint
ALTER TABLE `member_sessions` DROP FOREIGN KEY `member_sessions_accountId_member_accounts_id_fk`;
--> statement-breakpoint
ALTER TABLE `service_orders` DROP FOREIGN KEY `service_orders_accountId_member_accounts_id_fk`;
--> statement-breakpoint
ALTER TABLE `system_settings` DROP FOREIGN KEY `system_settings_accountId_member_accounts_id_fk`;
--> statement-breakpoint
DROP INDEX `member_sessions_account_expiry_idx` ON `member_sessions`;
--> statement-breakpoint
ALTER TABLE `member_accounts` ADD `companyId` int NULL;
--> statement-breakpoint
ALTER TABLE `member_sessions` ADD `memberAccountId` int NULL;
--> statement-breakpoint
UPDATE `member_accounts` SET `companyId` = `id` WHERE `companyId` IS NULL;
--> statement-breakpoint
UPDATE `member_sessions` SET `memberAccountId` = `accountId` WHERE `memberAccountId` IS NULL;
--> statement-breakpoint
DELETE FROM `member_sessions` WHERE `accountId` = 1;
--> statement-breakpoint
INSERT INTO `platform_admins` (`id`, `userName`, `email`, `passwordHash`, `recoveryCodeHash`, `active`, `createdAt`, `updatedAt`)
SELECT 1, `userName`, `email`, `passwordHash`, `recoveryCodeHash`, `active`, `createdAt`, `updatedAt`
FROM `member_accounts` WHERE `id` = 1 AND `email` = 'ivan.honemann@gmail.com';
--> statement-breakpoint
DELETE FROM `member_accounts` WHERE `id` = 1 AND `email` = 'ivan.honemann@gmail.com';
--> statement-breakpoint
ALTER TABLE `member_accounts` MODIFY COLUMN `role` enum('user','admin','company_admin','operator','technician') NOT NULL DEFAULT 'operator';
--> statement-breakpoint
UPDATE `member_accounts` SET `role` = CASE WHEN `role` = 'admin' OR `role` = 'user' THEN 'company_admin' ELSE `role` END;
--> statement-breakpoint
ALTER TABLE `member_accounts` MODIFY COLUMN `role` enum('company_admin','operator','technician') NOT NULL DEFAULT 'operator';
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','oauth_user','platform_admin') NOT NULL DEFAULT 'oauth_user';
--> statement-breakpoint
UPDATE `users` SET `role` = 'platform_admin' WHERE `id` = 1 AND `email` = 'ivan.honemann@gmail.com' AND `loginMethod` = 'google';
--> statement-breakpoint
UPDATE `users` SET `role` = 'oauth_user' WHERE `role` IN ('user','admin') AND NOT (`id` = 1 AND `email` = 'ivan.honemann@gmail.com' AND `loginMethod` = 'google');
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('oauth_user','platform_admin') NOT NULL DEFAULT 'oauth_user';
--> statement-breakpoint
ALTER TABLE `member_accounts` MODIFY COLUMN `companyId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `member_sessions` MODIFY COLUMN `memberAccountId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_sessions` ADD CONSTRAINT `platform_sessions_platformAdminId_platform_admins_id_fk` FOREIGN KEY (`platformAdminId`) REFERENCES `platform_admins`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `companies_active_idx` ON `companies` (`active`);
--> statement-breakpoint
CREATE INDEX `companies_name_idx` ON `companies` (`name`);
--> statement-breakpoint
CREATE INDEX `platform_sessions_admin_expiry_idx` ON `platform_sessions` (`platformAdminId`,`expiresAt`);
--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `member_accounts` ADD CONSTRAINT `member_accounts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `member_sessions` ADD CONSTRAINT `member_sessions_memberAccountId_member_accounts_id_fk` FOREIGN KEY (`memberAccountId`) REFERENCES `member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `member_accounts_company_idx` ON `member_accounts` (`companyId`);
--> statement-breakpoint
CREATE INDEX `member_accounts_company_role_idx` ON `member_accounts` (`companyId`,`role`);
--> statement-breakpoint
CREATE INDEX `member_sessions_account_expiry_idx` ON `member_sessions` (`memberAccountId`,`expiresAt`);
--> statement-breakpoint
ALTER TABLE `member_accounts` DROP COLUMN `companyName`;
--> statement-breakpoint
ALTER TABLE `member_sessions` DROP COLUMN `accountId`;
