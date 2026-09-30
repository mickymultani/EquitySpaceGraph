CREATE TABLE `market_refresh_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`expected_count` integer DEFAULT 0 NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`message` text
);
--> statement-breakpoint
CREATE TABLE `market_snapshot` (
	`symbol` text PRIMARY KEY NOT NULL,
	`price` real,
	`change` real,
	`change_pct` real,
	`previous_close` real,
	`market_cap` real,
	`shares_outstanding` real,
	`currency` text DEFAULT 'USD' NOT NULL,
	`company_url` text,
	`logo` text,
	`quote_timestamp` integer,
	`quote_refreshed_at` integer,
	`profile_refreshed_at` integer,
	`status` text DEFAULT 'unavailable' NOT NULL
);
