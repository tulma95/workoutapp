-- DropIndex
DROP INDEX "workout_sets_workout_id_tier_set_order_idx";

-- Add exercise_order as nullable first
ALTER TABLE "workout_sets" ADD COLUMN "exercise_order" INTEGER;

-- Populate from existing tier: T1 -> 1, T2 -> 2
UPDATE "workout_sets" SET "exercise_order" = CASE WHEN "tier" = 'T1' THEN 1 WHEN "tier" = 'T2' THEN 2 ELSE 1 END;

-- Make NOT NULL
ALTER TABLE "workout_sets" ALTER COLUMN "exercise_order" SET NOT NULL;

-- Drop tier columns
ALTER TABLE "workout_sets" DROP COLUMN "tier";
ALTER TABLE "plan_day_exercises" DROP COLUMN "tier";

-- CreateIndex
CREATE INDEX "workout_sets_workout_id_exercise_order_set_order_idx" ON "workout_sets"("workout_id", "exercise_order", "set_order");
