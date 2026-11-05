CREATE TABLE `initiative_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`initiative_id` text NOT NULL,
	`from_task_id` text,
	`to_task_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`initiative_id`) REFERENCES `initiatives`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `initiatives` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`push_messages` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `initiative_id` text;--> statement-breakpoint
CREATE INDEX `idx_initiative_messages_initiative_created` ON `initiative_messages` (`initiative_id`,`created_at`);