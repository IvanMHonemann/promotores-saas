-- Avisos criados pelo administrador geral da plataforma. Migração idempotente (TiDB).
CREATE TABLE IF NOT EXISTS platform_announcements (
  id INT AUTO_INCREMENT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  tone ENUM('info', 'warning', 'urgent') NOT NULL DEFAULT 'info',
  buttonLabel VARCHAR(80) NULL,
  buttonUrl VARCHAR(500) NULL,
  audienceScope ENUM('all', 'selected') NOT NULL DEFAULT 'all',
  roles VARCHAR(120) NOT NULL,
  startsAt DATE NULL,
  endsAt DATE NULL,
  dismissable TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdByPlatformAdminId INT NULL,
  updatedByPlatformAdminId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY platform_announcements_active_idx (active, startsAt, endsAt)
);

CREATE TABLE IF NOT EXISTS platform_announcement_companies (
  id INT AUTO_INCREMENT NOT NULL,
  announcementId INT NOT NULL,
  companyId INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY platform_announcement_companies_unique (announcementId, companyId),
  KEY platform_announcement_companies_company_idx (companyId)
);

CREATE TABLE IF NOT EXISTS platform_announcement_dismissals (
  id INT AUTO_INCREMENT NOT NULL,
  announcementId INT NOT NULL,
  memberAccountId INT NOT NULL,
  dismissedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY platform_announcement_dismissals_unique (announcementId, memberAccountId),
  KEY platform_announcement_dismissals_member_idx (memberAccountId)
);
