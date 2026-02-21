-- Populate username for any rows where it is still NULL
UPDATE "users"
SET "username" = COALESCE("username", "display_name" || '_' || id::text)
WHERE "username" IS NULL;

-- Add NOT NULL constraint to username
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- Drop display_name column
ALTER TABLE "users" DROP COLUMN "display_name";
