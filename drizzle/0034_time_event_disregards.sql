-- Referência: a tabela é criada em tempo de execução por ensureDisregardsTable() (server/ponto/ledger.ts).
-- Batida desconsiderada pelo administrador: a marcação original NUNCA é apagada (Portaria MTP 671/2021);
-- aqui fica quem desconsiderou, quando e por quê. Reconsiderar preenche revertedAt (o histórico permanece).
CREATE TABLE IF NOT EXISTS time_event_disregards (
  id INT AUTO_INCREMENT NOT NULL,
  companyId INT NOT NULL,
  memberAccountId INT NOT NULL,
  timeEventId INT NOT NULL,
  reason TEXT NOT NULL,
  decidedByMemberId INT NULL,
  decidedByName VARCHAR(255) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revertedAt TIMESTAMP NULL,
  revertedByMemberId INT NULL,
  revertedByName VARCHAR(255) NULL,
  revertReason TEXT NULL,
  PRIMARY KEY (id),
  KEY time_event_disregards_event_idx (companyId, timeEventId),
  KEY time_event_disregards_member_idx (companyId, memberAccountId)
);
