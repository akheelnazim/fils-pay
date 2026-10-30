-- M6: platform_stats.total_processed_fils was INTEGER (max 2,147,483,647
-- fils). The volume tier starts at 2,000,000,000 fils, so the counter
-- overflowed soon after the tier kicked in. Widen it to BIGINT like every
-- other fils column.
ALTER TABLE platform_stats ALTER COLUMN total_processed_fils TYPE BIGINT;
