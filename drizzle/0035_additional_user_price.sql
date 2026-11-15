-- Preço adicional por funcionário extra nos planos comerciais. Migração idempotente.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subscription_plans'
    AND COLUMN_NAME = 'additionalUserPrice'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `subscription_plans` ADD COLUMN `additionalUserPrice` decimal(12,2) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
