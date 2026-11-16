-- Avisos criados pelo admin ou supervisor da empresa. Migração idempotente (TiDB).
-- Não altera nem apaga avisos existentes da plataforma.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_announcements' AND COLUMN_NAME = 'source'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `platform_announcements` ADD COLUMN `source` varchar(16) NOT NULL DEFAULT ''platform''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_announcements' AND COLUMN_NAME = 'companyId'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `platform_announcements` ADD COLUMN `companyId` int NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_announcements' AND COLUMN_NAME = 'createdByMemberAccountId'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `platform_announcements` ADD COLUMN `createdByMemberAccountId` int NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_announcements' AND COLUMN_NAME = 'updatedByMemberAccountId'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `platform_announcements` ADD COLUMN `updatedByMemberAccountId` int NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_announcements' AND COLUMN_NAME = 'targetMode'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `platform_announcements` ADD COLUMN `targetMode` varchar(16) NOT NULL DEFAULT ''roles''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_announcements' AND INDEX_NAME = 'platform_announcements_source_company_idx'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `platform_announcements` ADD INDEX `platform_announcements_source_company_idx` (`source`, `companyId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS platform_announcement_members (
  id INT AUTO_INCREMENT NOT NULL,
  announcementId INT NOT NULL,
  memberAccountId INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY platform_announcement_members_unique (announcementId, memberAccountId),
  KEY platform_announcement_members_member_idx (memberAccountId)
);
