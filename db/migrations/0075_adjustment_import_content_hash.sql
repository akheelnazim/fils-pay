-- R5: the same adjustment CSV could be applied twice. Each import now stores
-- a hash of its parsed rows; a second import with the same content is refused.
-- Imports made before this migration keep NULL (any past duplicates stay as
-- they are and do not block the index).
ALTER TABLE adjustment_imports ADD COLUMN content_hash TEXT;
CREATE UNIQUE INDEX adjustment_imports_content_hash_key ON adjustment_imports (content_hash);
