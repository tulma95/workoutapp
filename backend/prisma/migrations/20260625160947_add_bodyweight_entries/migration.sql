-- CreateTable
CREATE TABLE "bodyweight_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bodyweight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bodyweight_entries_user_id_recorded_at_idx" ON "bodyweight_entries"("user_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "bodyweight_entries" ADD CONSTRAINT "bodyweight_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
