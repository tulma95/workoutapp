-- AlterTable
ALTER TABLE "training_maxes" ADD COLUMN     "previous_weight" DECIMAL(6,2),
ADD COLUMN     "workout_id" INTEGER;

-- AddForeignKey
ALTER TABLE "training_maxes" ADD CONSTRAINT "training_maxes_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
