-- CreateTable
CREATE TABLE "plan_progression_rules" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "exercise_id" INTEGER,
    "category" TEXT,
    "min_reps" INTEGER NOT NULL,
    "max_reps" INTEGER NOT NULL,
    "increase" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "plan_progression_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plans" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "plan_progression_rules" ADD CONSTRAINT "plan_progression_rules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_progression_rules" ADD CONSTRAINT "plan_progression_rules_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
