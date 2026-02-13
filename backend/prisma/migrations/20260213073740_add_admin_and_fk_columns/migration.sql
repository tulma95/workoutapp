-- AlterTable
ALTER TABLE "training_maxes" ADD COLUMN     "exercise_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workout_sets" ADD COLUMN     "exercise_id" INTEGER,
ADD COLUMN     "is_progression" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "plan_day_id" INTEGER;

-- AddForeignKey
ALTER TABLE "training_maxes" ADD CONSTRAINT "training_maxes_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_day_id_fkey" FOREIGN KEY ("plan_day_id") REFERENCES "plan_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
