-- CreateTable
CREATE TABLE "story_insights" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "reach" INTEGER,
    "replies" INTEGER,
    "shares" INTEGER,
    "tapsForward" INTEGER,
    "tapsBack" INTEGER,
    "exits" INTEGER,
    "profileVisits" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_insights_mediaId_key" ON "story_insights"("mediaId");

-- CreateIndex
CREATE INDEX "story_insights_clientId_timestamp_idx" ON "story_insights"("clientId", "timestamp");

-- AddForeignKey
ALTER TABLE "story_insights" ADD CONSTRAINT "story_insights_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
