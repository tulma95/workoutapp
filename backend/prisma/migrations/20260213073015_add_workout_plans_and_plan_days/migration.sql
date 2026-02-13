-- CreateTable
CREATE TABLE "workout_plans" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "days_per_week" INTEGER NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_days" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "day_number" INTEGER NOT NULL,
    "name" TEXT,

    CONSTRAINT "plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_plans_slug_key" ON "workout_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plan_days_plan_id_day_number_key" ON "plan_days"("plan_id", "day_number");

-- AddForeignKey
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
