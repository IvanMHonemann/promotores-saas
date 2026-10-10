-- QR Code: identificador público opaco por extintor
ALTER TABLE `extinguishers` ADD COLUMN `publicToken` varchar(32) NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `extinguishers_public_token_uidx` ON `extinguishers` (`publicToken`);
