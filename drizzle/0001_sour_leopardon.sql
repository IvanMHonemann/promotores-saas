CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`cnpj` varchar(30),
	`address` text,
	`city` varchar(120) NOT NULL,
	`cep` varchar(20),
	`phone` varchar(50),
	`contactName` varchar(255),
	`cpf` varchar(30),
	`birthDate` varchar(20),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `extinguishers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`typeModel` varchar(100) NOT NULL,
	`capacity` varchar(50),
	`serialNumber` varchar(100),
	`locationInBuilding` varchar(200),
	`expirationDate` date NOT NULL,
	`lastInspectionDate` date,
	`status` enum('ok','warning','expired') NOT NULL DEFAULT 'ok',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `extinguishers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceOrderId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` int NOT NULL,
	`orderDate` date NOT NULL,
	`clientId` int NOT NULL,
	`replacedAndDelivered` varchar(10) DEFAULT 'SIM',
	`leftReserve` varchar(10) DEFAULT 'NÃO',
	`reserveDetails` varchar(255),
	`extinguisherExpiration` varchar(100),
	`licenseExpiration` varchar(100),
	`totalAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`paymentMethod` varchar(50) DEFAULT 'A VISTA',
	`installmentsCount` int DEFAULT 1,
	`installmentDates` varchar(255),
	`responsibleName` varchar(255),
	`responsibleCpf` varchar(30),
	`responsibleBirthDate` varchar(20),
	`observations` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_settingKey_unique` UNIQUE(`settingKey`)
);
