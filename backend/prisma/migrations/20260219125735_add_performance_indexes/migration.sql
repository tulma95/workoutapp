-- CreateIndex
CREATE INDEX "user_plans_user_id_idx" ON "user_plans"("user_id");

-- CreateIndex
CREATE INDEX "workouts_user_id_status_idx" ON "workouts"("user_id", "status");
