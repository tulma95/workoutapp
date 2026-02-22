-- CreateTable
CREATE TABLE "feed_event_comments" (
    "id" SERIAL NOT NULL,
    "feed_event_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_event_comments_feed_event_id_idx" ON "feed_event_comments"("feed_event_id");

-- AddForeignKey
ALTER TABLE "feed_event_comments" ADD CONSTRAINT "feed_event_comments_feed_event_id_fkey" FOREIGN KEY ("feed_event_id") REFERENCES "feed_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_event_comments" ADD CONSTRAINT "feed_event_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
