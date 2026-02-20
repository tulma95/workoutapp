-- CreateTable
CREATE TABLE "feed_event_reactions" (
    "id" SERIAL NOT NULL,
    "feed_event_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_event_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_event_reactions_feed_event_id_idx" ON "feed_event_reactions"("feed_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "feed_event_reactions_feed_event_id_user_id_emoji_key" ON "feed_event_reactions"("feed_event_id", "user_id", "emoji");

-- AddForeignKey
ALTER TABLE "feed_event_reactions" ADD CONSTRAINT "feed_event_reactions_feed_event_id_fkey" FOREIGN KEY ("feed_event_id") REFERENCES "feed_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_event_reactions" ADD CONSTRAINT "feed_event_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
