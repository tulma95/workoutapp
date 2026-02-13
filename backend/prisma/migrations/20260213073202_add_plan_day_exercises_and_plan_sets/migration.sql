-- CreateTable
CREATE TABLE "plan_day_exercises" (
    "id" SERIAL NOT NULL,
    "plan_day_id" INTEGER NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "tm_exercise_id" INTEGER NOT NULL,
    "display_name" TEXT,

    CONSTRAINT "plan_day_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_sets" (
    "id" SERIAL NOT NULL,
    "plan_day_exercise_id" INTEGER NOT NULL,
    "set_order" INTEGER NOT NULL,
    "percentage" DECIMAL(5,4) NOT NULL,
    "reps" INTEGER NOT NULL,
    "is_amrap" BOOLEAN NOT NULL DEFAULT false,
    "is_progression" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plan_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_day_exercises_plan_day_id_sort_order_key" ON "plan_day_exercises"("plan_day_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "plan_sets_plan_day_exercise_id_set_order_key" ON "plan_sets"("plan_day_exercise_id", "set_order");

-- AddForeignKey
ALTER TABLE "plan_day_exercises" ADD CONSTRAINT "plan_day_exercises_plan_day_id_fkey" FOREIGN KEY ("plan_day_id") REFERENCES "plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_day_exercises" ADD CONSTRAINT "plan_day_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_day_exercises" ADD CONSTRAINT "plan_day_exercises_tm_exercise_id_fkey" FOREIGN KEY ("tm_exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sets" ADD CONSTRAINT "plan_sets_plan_day_exercise_id_fkey" FOREIGN KEY ("plan_day_exercise_id") REFERENCES "plan_day_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
