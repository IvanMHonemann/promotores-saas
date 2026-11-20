CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NULL,
  `userId` int NULL,
  `userName` varchar(255) NULL,
  `userEmail` varchar(320) NULL,
  `action` varchar(64) NOT NULL,
  `module` varchar(64) NOT NULL,
  `entityType` varchar(64) NOT NULL,
  `entityId` int NULL,
  `entityLabel` varchar(255) NULL,
  `description` text NOT NULL,
  `oldData` text NULL,
  `newData` text NULL,
  `ipAddress` varchar(64) NULL,
  `userAgent` varchar(512) NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `audit_logs_company_idx` ON `audit_logs` (`companyId`);
CREATE INDEX `audit_logs_company_created_idx` ON `audit_logs` (`companyId`, `createdAt`);
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`userId`);
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`, `entityId`);
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);
CREATE INDEX `audit_logs_module_idx` ON `audit_logs` (`module`);
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`createdAt`);
