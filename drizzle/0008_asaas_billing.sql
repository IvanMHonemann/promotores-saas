-- Extend companies with subscription denormalized state
ALTER TABLE `companies`
  ADD COLUMN `planId` int NULL,
  ADD COLUMN `subscriptionStatus` enum('trial','active','pending','overdue','suspended','canceled','test','expired') NULL,
  ADD COLUMN `asaasCustomerId` varchar(64) NULL,
  ADD COLUMN `asaasSubscriptionId` varchar(64) NULL,
  ADD COLUMN `subscriptionStartedAt` timestamp NULL,
  ADD COLUMN `subscriptionExpiresAt` timestamp NULL,
  ADD COLUMN `trialEndsAt` timestamp NULL,
  ADD COLUMN `gracePeriodEndsAt` timestamp NULL;

CREATE INDEX `companies_plan_idx` ON `companies` (`planId`);
CREATE INDEX `companies_subscription_status_idx` ON `companies` (`subscriptionStatus`);

-- Extend company_subscriptions for Asaas + billing periods
ALTER TABLE `company_subscriptions`
  MODIFY COLUMN `status` enum('trial','active','pending','overdue','suspended','canceled','test','expired') NOT NULL DEFAULT 'active',
  ADD COLUMN `asaasCustomerId` varchar(64) NULL,
  ADD COLUMN `asaasSubscriptionId` varchar(64) NULL,
  ADD COLUMN `billingInterval` enum('monthly','yearly') NULL,
  ADD COLUMN `amount` decimal(12,2) NULL,
  ADD COLUMN `currentPeriodStart` date NULL,
  ADD COLUMN `currentPeriodEnd` date NULL,
  ADD COLUMN `trialEndsAt` date NULL,
  ADD COLUMN `gracePeriodEndsAt` date NULL,
  ADD COLUMN `cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
  ADD COLUMN `canceledAt` timestamp NULL;

CREATE INDEX `company_subscriptions_asaas_sub_idx` ON `company_subscriptions` (`asaasSubscriptionId`);

CREATE TABLE IF NOT EXISTS `payments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `subscriptionId` int NULL,
  `asaasPaymentId` varchar(64) NULL,
  `asaasCustomerId` varchar(64) NULL,
  `asaasSubscriptionId` varchar(64) NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `netAmount` decimal(12,2) NULL,
  `billingType` enum('BOLETO','CREDIT_CARD','PIX','UNDEFINED','MOCK') NOT NULL DEFAULT 'MOCK',
  `status` enum('PENDING','CONFIRMED','RECEIVED','OVERDUE','REFUNDED','DELETED','MOCK_APPROVED','MOCK_PENDING','MOCK_OVERDUE') NOT NULL DEFAULT 'PENDING',
  `dueDate` date NULL,
  `paymentDate` date NULL,
  `invoiceUrl` text,
  `bankSlipUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);

CREATE INDEX `payments_company_idx` ON `payments` (`companyId`);
CREATE INDEX `payments_subscription_idx` ON `payments` (`subscriptionId`);
CREATE INDEX `payments_asaas_payment_idx` ON `payments` (`asaasPaymentId`);
CREATE INDEX `payments_status_idx` ON `payments` (`status`);

CREATE TABLE IF NOT EXISTS `payment_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventId` varchar(128) NOT NULL,
  `event` varchar(120) NOT NULL,
  `paymentId` int NULL,
  `subscriptionId` int NULL,
  `payload` text NOT NULL,
  `processed` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `payment_events_eventId_unique` UNIQUE(`eventId`)
);

CREATE INDEX `payment_events_processed_idx` ON `payment_events` (`processed`);
