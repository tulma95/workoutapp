-- CreateTable
CREATE TABLE "user_plan_schedules" (
    "id" SERIAL NOT NULL,
    "user_plan_id" INTEGER NOT NULL,
    "day_number" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_plan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_plan_schedules_user_plan_id_day_number_key" ON "user_plan_schedules"("user_plan_id", "day_number");

-- AddForeignKey
ALTER TABLE "user_plan_schedules" ADD CONSTRAINT "user_plan_schedules_user_plan_id_fkey" FOREIGN KEY ("user_plan_id") REFERENCES "user_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
