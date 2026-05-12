ALTER TABLE `waha_workers` ADD `ingress_secret` text;
--> statement-breakpoint
UPDATE `waha_workers` SET `ingress_secret` = lower(hex(randomblob(16))) WHERE `ingress_secret` IS NULL;