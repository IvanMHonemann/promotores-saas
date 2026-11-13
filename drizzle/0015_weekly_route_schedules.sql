-- Programação recorrente por empresa/promotor/dia; migração aditiva.
CREATE TABLE IF NOT EXISTS `weekly_route_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `promoterId` int NOT NULL,
  `weekday` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `storeIds` json NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `weekly_route_schedules_promoter_day_unique` (`companyId`, `promoterId`, `weekday`),
  KEY `weekly_route_schedules_company_idx` (`companyId`),
  CONSTRAINT `weekly_route_schedules_company_fk` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `weekly_route_schedules_promoter_fk` FOREIGN KEY (`promoterId`) REFERENCES `member_accounts` (`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
ALTER TABLE `routes` ADD COLUMN `weeklyScheduleId` int NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `routes_weekly_occurrence_unique` ON `routes` (`weeklyScheduleId`, `date`);
--> statement-breakpoint
ALTER TABLE `routes` ADD CONSTRAINT `routes_weekly_schedule_fk` FOREIGN KEY (`weeklyScheduleId`) REFERENCES `weekly_route_schedules` (`id`) ON DELETE SET NULL;
