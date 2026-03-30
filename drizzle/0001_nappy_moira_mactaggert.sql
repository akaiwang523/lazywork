CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractNumber` varchar(64) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`clientName` varchar(128) NOT NULL,
	`phone` varchar(20),
	`mobile` varchar(20),
	`county` varchar(64) NOT NULL,
	`district` varchar(64) NOT NULL,
	`address` text NOT NULL,
	`caseworker` varchar(128) NOT NULL,
	`onlineDate` varchar(20),
	`visitStatus` enum('unvisited','visited') NOT NULL DEFAULT 'unvisited',
	`lastVisitedAt` timestamp,
	`latitude` varchar(32),
	`longitude` varchar(32),
	`geocodeStatus` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cases_contractNumber_unique` UNIQUE(`contractNumber`)
);
--> statement-breakpoint
CREATE TABLE `visitHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`visitDate` timestamp NOT NULL,
	`notes` text,
	`result` enum('completed','rescheduled','unable_to_contact') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitRoutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeName` varchar(128) NOT NULL,
	`district` varchar(64) NOT NULL,
	`caseIds` text NOT NULL,
	`routeData` text,
	`estimatedDuration` int,
	`status` enum('planning','in_progress','completed') NOT NULL DEFAULT 'planning',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitRoutes_id` PRIMARY KEY(`id`)
);
