-- DropForeignKey
ALTER TABLE "training_maxes" DROP CONSTRAINT "training_maxes_exercise_id_fkey";

-- DropForeignKey
ALTER TABLE "workout_sets" DROP CONSTRAINT "workout_sets_exercise_id_fkey";

-- AddForeignKey
ALTER TABLE "training_maxes" ADD CONSTRAINT "training_maxes_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
