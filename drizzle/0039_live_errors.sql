-- Painel Erros ao vivo: marcação local (normal / correção pedida) e histórico das rotinas da madrugada.
-- Idempotente (TiDB).

CREATE TABLE IF NOT EXISTS live_error_overrides (
  id INT AUTO_INCREMENT NOT NULL,
  sentryIssueId VARCHAR(64) NOT NULL,
  classification VARCHAR(16) NOT NULL,
  githubIssueNumber INT NULL,
  githubIssueUrl VARCHAR(255) NULL,
  sentryIgnored TINYINT NOT NULL DEFAULT 0,
  updatedBy VARCHAR(255) NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY live_error_overrides_issue (sentryIssueId)
);

CREATE TABLE IF NOT EXISTS platform_job_runs (
  id INT AUTO_INCREMENT NOT NULL,
  job VARCHAR(64) NOT NULL,
  ok TINYINT NOT NULL,
  summary VARCHAR(500) NULL,
  startedAt TIMESTAMP NOT NULL,
  finishedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY platform_job_runs_job_finished (job, finishedAt)
);
