CREATE TABLE IF NOT EXISTS `promoter_profiles` (
  `memberAccountId` int NOT NULL,
  `companyId` int NOT NULL,
  `employeeCode` varchar(50) DEFAULT NULL,
  `workStartTime` varchar(5) DEFAULT NULL,
  `workEndTime` varchar(5) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`memberAccountId`),
  UNIQUE KEY `promoter_profiles_company_employee_code_unique` (`companyId`, `employeeCode`),
  KEY `promoter_profiles_company_idx` (`companyId`),
  CONSTRAINT `promoter_profiles_member_fk` FOREIGN KEY (`memberAccountId`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promoter_profiles_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
