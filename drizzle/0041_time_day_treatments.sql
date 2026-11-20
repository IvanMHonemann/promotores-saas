-- Decisões do administrador sobre falta/justificativa (abonar ou banco de horas devendo).
-- Não altera marcações originais. Idempotente (TiDB/MySQL).

CREATE TABLE IF NOT EXISTS time_day_treatments (
  id int NOT NULL AUTO_INCREMENT,
  companyId int NOT NULL,
  memberAccountId int NOT NULL,
  day varchar(10) NOT NULL,
  decision varchar(32) NOT NULL,
  notes text NULL,
  decidedByUserId int NULL,
  decidedByName varchar(255) NULL,
  decidedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversedAt timestamp NULL,
  reversedByUserId int NULL,
  reversedByName varchar(255) NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY time_day_treatments_member_day (companyId, memberAccountId, day),
  KEY time_day_treatments_company (companyId)
);
