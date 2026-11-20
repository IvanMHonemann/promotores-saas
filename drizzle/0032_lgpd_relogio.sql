-- LGPD (aviso ao trabalhador, pedidos do titular) e conferência do relógio.
-- Também criadas automaticamente no primeiro uso (server/lgpd/router.ts ensureLgpdTables, server/ponto/clock.ts).
CREATE TABLE IF NOT EXISTS privacy_acknowledgements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  companyId INT NOT NULL,
  memberAccountId INT NOT NULL,
  noticeVersion VARCHAR(32) NOT NULL,
  textHash CHAR(64) NOT NULL,
  ipAddress VARCHAR(64) NULL,
  userAgent VARCHAR(512) NULL,
  acknowledgedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX privacy_ack_member_idx (companyId, memberAccountId, noticeVersion)
);
CREATE TABLE IF NOT EXISTS lgpd_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  companyId INT NOT NULL,
  memberAccountId INT NOT NULL,
  kind VARCHAR(24) NOT NULL,
  message TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  ipAddress VARCHAR(64) NULL,
  userAgent VARCHAR(512) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvedAt TIMESTAMP NULL,
  resolvedBy VARCHAR(255) NULL,
  resolution TEXT NULL,
  INDEX lgpd_requests_company_idx (companyId, status)
);
CREATE TABLE IF NOT EXISTS clock_checks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checkedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(64) NOT NULL,
  method VARCHAR(16) NOT NULL,
  precisionMs INT NOT NULL,
  serverOffsetMs INT NOT NULL,
  databaseOffsetMs INT NULL,
  ok TINYINT(1) NOT NULL,
  error VARCHAR(255) NULL,
  INDEX clock_checks_checked_idx (checkedAt)
);
