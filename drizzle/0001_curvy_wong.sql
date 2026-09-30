CREATE TABLE `backfill_company` (
	`ticker` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`layer_id` text NOT NULL,
	`layer` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cik` text,
	`filings_found` integer DEFAULT 0 NOT NULL,
	`filings_processed` integer DEFAULT 0 NOT NULL,
	`claims_extracted` integer DEFAULT 0 NOT NULL,
	`claims_verified` integer DEFAULT 0 NOT NULL,
	`claims_review` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`started_at` integer,
	`completed_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backfill_company_status_idx` ON `backfill_company` (`status`);--> statement-breakpoint
CREATE INDEX `backfill_company_layer_idx` ON `backfill_company` (`layer_id`);--> statement-breakpoint
CREATE TABLE `extracted_claim` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`subject_name` text NOT NULL,
	`predicate` text NOT NULL,
	`object_name` text NOT NULL,
	`object_ticker` text,
	`relationship_class` text NOT NULL,
	`product` text,
	`amount` text,
	`percentage` text,
	`mechanism` text,
	`evidence_excerpt` text NOT NULL,
	`source_url` text NOT NULL,
	`source_form` text NOT NULL,
	`filing_date` text,
	`groq_confidence` real NOT NULL,
	`jev_probability` real,
	`jev_materiality` real,
	`evidence_status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `extracted_claim_ticker_idx` ON `extracted_claim` (`ticker`);--> statement-breakpoint
CREATE INDEX `extracted_claim_status_idx` ON `extracted_claim` (`evidence_status`);--> statement-breakpoint
CREATE INDEX `extracted_claim_object_idx` ON `extracted_claim` (`object_ticker`);--> statement-breakpoint
CREATE TABLE `source_document` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`cik` text,
	`form` text NOT NULL,
	`filing_date` text,
	`report_date` text,
	`source_url` text NOT NULL,
	`status` text NOT NULL,
	`characters_analyzed` integer DEFAULT 0 NOT NULL,
	`error` text,
	`processed_at` integer
);
--> statement-breakpoint
CREATE INDEX `source_document_ticker_idx` ON `source_document` (`ticker`);--> statement-breakpoint
CREATE INDEX `source_document_status_idx` ON `source_document` (`status`);