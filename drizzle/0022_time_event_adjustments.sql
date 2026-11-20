-- Preserva o valor original de marcações ajustadas (o app também cria a tabela sob demanda; idempotente).
CREATE TABLE IF NOT EXISTS `time_event_adjustments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `timeEventId` int NOT NULL,
  `correctionRequestId` int NULL,
  `memberAccountId` int NOT NULL,
  `originalType` varchar(20) NOT NULL,
  `originalTime` timestamp NOT NULL,
  `correctedType` varchar(20) NOT NULL,
  `correctedTime` timestamp NOT NULL,
  `justification` text NOT NULL,
  `reviewedByMemberId` int NULL,
  `reviewedByName` varchar(255) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `time_event_adj_event_idx` (`companyId`, `timeEventId`),
  KEY `time_event_adj_member_idx` (`companyId`, `memberAccountId`)
);
