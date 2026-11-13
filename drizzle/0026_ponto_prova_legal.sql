-- Ponto com valor de prova (Portaria MTP 671/2021). O app também aplica isto sob demanda (server/ponto/ledger.ts).
-- Marcação original nunca é alterada: correções e inclusões são registros novos (origin = 'adjustment' | 'inclusion').
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS nsr BIGINT NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS recordHash VARCHAR(64) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS prevHash VARCHAR(64) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS contentHash VARCHAR(64) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS timeZone VARCHAR(64) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS collectorId VARCHAR(8) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS offline TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS clientTime TIMESTAMP NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS workerCpf VARCHAR(14) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS origin VARCHAR(16) NOT NULL DEFAULT 'original';
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS replacesEventId INT NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS correctionRequestId INT NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS recordedByMemberId INT NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS recordedByName VARCHAR(255) NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS reason TEXT NULL;
ALTER TABLE time_events ADD COLUMN IF NOT EXISTS sealedLegacy TINYINT(1) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS time_events_company_nsr_unique ON time_events (companyId, nsr);
CREATE INDEX IF NOT EXISTS time_events_replaces_idx ON time_events (companyId, replacesEventId);

CREATE TABLE IF NOT EXISTS rep_ledger_state (
  companyId INT NOT NULL PRIMARY KEY,
  lastNsr BIGINT NOT NULL DEFAULT 0,
  lastHash VARCHAR(64) NULL,
  lastTreatmentHash VARCHAR(64) NULL,
  initializedAt TIMESTAMP NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timesheet_acceptances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  companyId INT NOT NULL,
  memberAccountId INT NOT NULL,
  month CHAR(7) NOT NULL,
  decision VARCHAR(16) NOT NULL DEFAULT 'accepted',
  documentHash CHAR(64) NOT NULL,
  summary TEXT NULL,
  comment TEXT NULL,
  ipAddress VARCHAR(64) NULL,
  userAgent VARCHAR(512) NULL,
  acceptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY timesheet_acceptances_member_idx (companyId, memberAccountId, month),
  KEY timesheet_acceptances_month_idx (companyId, month)
);

-- Recomendado (fora do app): o usuário do banco usado pela aplicação não deveria ter UPDATE/DELETE em time_events
-- além das colunas de selo. Exemplo (ajuste ao seu usuário):
--   REVOKE DELETE ON <banco>.time_events FROM '<usuario_app>'@'%';
-- O TiDB não tem triggers; a proteção do app é: nenhum código faz UPDATE/DELETE de marcação (teste automatizado)
-- e a verificação de integridade recalcula as cadeias de hash.
