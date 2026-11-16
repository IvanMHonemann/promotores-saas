-- Aceite dos Termos de Uso e da Política de Privacidade pelo administrador da empresa.
-- Migração idempotente (TiDB). Não altera privacy_acknowledgements (ciência do aviso ao trabalhador).

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id INT AUTO_INCREMENT NOT NULL,
  companyId INT NOT NULL,
  memberAccountId INT NOT NULL,
  version VARCHAR(32) NOT NULL,
  acceptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ipAddress VARCHAR(64) NULL,
  userAgent VARCHAR(512) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY legal_acceptances_unique (companyId, memberAccountId, version),
  KEY legal_acceptances_company_version_idx (companyId, version)
);
