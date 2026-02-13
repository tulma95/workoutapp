-- Step 1: Populate exerciseId from exercise slug in training_maxes
UPDATE training_maxes tm
SET exercise_id = e.id
FROM exercises e
WHERE tm.exercise = e.slug AND tm.exercise_id IS NULL;

-- Step 2: Populate exerciseId from exercise slug in workout_sets
UPDATE workout_sets ws
SET exercise_id = e.id
FROM exercises e
WHERE ws.exercise = e.slug AND ws.exercise_id IS NULL;

-- Step 3: Make exerciseId non-nullable in training_maxes
ALTER TABLE training_maxes ALTER COLUMN exercise_id SET NOT NULL;

-- Step 4: Make exerciseId non-nullable in workout_sets
ALTER TABLE workout_sets ALTER COLUMN exercise_id SET NOT NULL;

-- Step 5: Drop old unique constraint on training_maxes (if it exists)
ALTER TABLE training_maxes DROP CONSTRAINT IF EXISTS training_maxes_user_id_exercise_effective_date_key;

-- Step 6: Add new unique constraint using exerciseId (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_maxes_user_id_exercise_id_effective_date_key'
  ) THEN
    ALTER TABLE training_maxes ADD CONSTRAINT training_maxes_user_id_exercise_id_effective_date_key
      UNIQUE (user_id, exercise_id, effective_date);
  END IF;
END$$;

-- Step 7: Drop the exercise string column from training_maxes (if it exists)
ALTER TABLE training_maxes DROP COLUMN IF EXISTS exercise;

-- Step 8: Drop the exercise string column from workout_sets (if it exists)
ALTER TABLE workout_sets DROP COLUMN IF EXISTS exercise;

-- Step 9: Rename exerciseRef relations to exercise (already named correctly in Prisma, just for clarity)
-- No SQL changes needed - Prisma will handle the relation naming
